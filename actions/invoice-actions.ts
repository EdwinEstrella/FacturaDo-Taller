"use server"


import { requireAuth } from "@/actions/auth-actions";
import { createServerClient } from "@/lib/insforge/client"
import { isMeasuredMode } from "@/lib/product-measurements"
import type { InvoiceItem } from "@/types"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "./auth-actions"
import { addClientHistoryEntry } from "./client-history-actions"



const InvoiceItemSchema = z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().positive(),
    price: z.number().min(0),
    variantId: z.string().nullable().optional(),
    characteristics: z.array(z.object({
        label: z.string().trim().min(1),
        value: z.string().trim().min(1),
    })).max(50).default([]),
})

const InvoiceSchema = z.object({
    clientId: z.string(),
    clientName: z.string().optional(),
    items: z.array(InvoiceItemSchema).min(1),
    total: z.number().min(0),
    paymentMethod: z.string().optional(),
    ncfType: z.string().optional(),
    shippingCost: z.number().min(0).optional(),
    deliveryDate: z.date().optional(),
    notes: z.string().optional(),
    amountPaid: z.number().min(0).optional(),
    tax: z.number().min(0).optional(),
    discount: z.number().min(0).optional(),
    hasNcf: z.boolean().optional(),
    sourceQuoteId: z.string().optional(),
})

type InvoiceFormData = z.infer<typeof InvoiceSchema>

type InventoryItem = {
    productId: string | null
    variantId?: string | null
    quantity: number
    productName?: string
}

type DatabaseClient = ReturnType<typeof createServerClient>

function assertProductQuantityMode(product: { name?: string | null, unitType?: string | null, measurementUnit?: string | null }, quantity: number, fallbackName?: string) {
    if (!isMeasuredMode(product) && !Number.isInteger(quantity)) {
        throw new Error(`El producto ${fallbackName || product.name || "seleccionado"} solo permite cantidades enteras`)
    }
}

async function syncProductStockFromVariants(insforge: DatabaseClient, productId: string) {
    await insforge.database.rpc("sync_product_stock_from_variants", { p_product_id: productId })
}

async function adjustInventoryStock(insforge: DatabaseClient, item: InventoryItem, delta: number) {
    if (!item.productId) return

    const { data: product } = await insforge.database
        .from('Product')
        .select('*')
        .eq('id', item.productId)
        .single()

    if (!product) {
        throw new Error(`Product with ID ${item.productId} not found.`)
    }

    assertProductQuantityMode(product, Number(item.quantity), item.productName)

    if (item.variantId) {
        const { data: variant } = await insforge.database
            .from('ProductVariant')
            .select('*')
            .eq('id', item.variantId)
            .single()

        if (!variant) {
            throw new Error(`Variant with ID ${item.variantId} not found.`)
        }

        const nextStock = Number(variant.stock || 0) + delta
        if (nextStock < 0) {
            throw new Error(`Insufficient stock for variant ${item.productName || variant.name}. Available: ${variant.stock}, Requested: ${Math.abs(delta)}`)
        }

        await insforge.database
            .from('ProductVariant')
            .update({ stock: nextStock })
            .eq('id', item.variantId)

        await syncProductStockFromVariants(insforge, item.productId)
        return
    }

    if (product.isService) return

    const nextStock = Number(product.stock || 0) + delta
    if (nextStock < 0) {
        throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${Math.abs(delta)}`)
    }

    await insforge.database
        .from('Product')
        .update({ stock: nextStock })
        .eq('id', item.productId)
}

async function validateInventoryAvailability(insforge: DatabaseClient, items: InventoryItem[]) {
    for (const item of items) {
        if (!item.productId) continue

        const { data: product } = await insforge.database
            .from('Product')
            .select('*')
            .eq('id', item.productId)
            .single()

        if (!product) {
            throw new Error(`Product with ID ${item.productId} not found.`)
        }

        assertProductQuantityMode(product, Number(item.quantity), item.productName)

        if (item.variantId) {
            const { data: variant } = await insforge.database
                .from('ProductVariant')
                .select('*')
                .eq('id', item.variantId)
                .single()

            if (!variant) {
                throw new Error(`Variant with ID ${item.variantId} not found.`)
            }

            if (Number(variant.stock || 0) < item.quantity) {
                throw new Error(`Insufficient stock for variant ${item.productName || variant.name}. Available: ${variant.stock}, Requested: ${item.quantity}`)
            }

            continue
        }

        if (!product.isService && Number(product.stock || 0) < item.quantity) {
            throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`)
        }
    }
}

export async function createInvoice(data: InvoiceFormData) {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const validated = InvoiceSchema.safeParse(data)

    if (!validated.success) {
        return { success: false, error: validated.error.message }
    }

    const insforge = createServerClient()

    try {
        await validateInventoryAvailability(insforge, data.items)
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Stock validation failed" }
    }

    const { clientId, clientName, items, total, paymentMethod, shippingCost, deliveryDate, notes, amountPaid } = validated.data

    const isCredit = paymentMethod === "CREDIT"

    let status = "PAID"
    let balance = 0

    if (isCredit) {
        status = "PENDING"
        balance = total
    } else if (amountPaid !== undefined && amountPaid < total) {
        status = "PENDING"
        balance = total - amountPaid
    }

    try {
        // Get max sequence number to increment it
        const { data: latestInvoice } = await insforge.database
            .from('Invoice')
            .select('sequenceNumber')
            .order('sequenceNumber', { ascending: false })
            .limit(1)
            .single()
            
        const nextSequence = (latestInvoice?.sequenceNumber || 0) + 1

        // Create Invoice
        const { data: invoice, error: invoiceError } = await insforge.database
            .from('Invoice')
            .insert([{
                clientId: clientId,
                clientName: clientName,
                total: total,
                status: status,
                paymentMethod: paymentMethod,
                shippingCost: shippingCost || 0,
                deliveryDate: deliveryDate?.toISOString(),
                notes: notes,
                balance: balance,
                tax: validated.data.tax || 0,
                discount: validated.data.discount || 0,
                hasNcf: Number(validated.data.tax || 0) > 0,
                createdById: user.id,
                sequenceNumber: nextSequence
            }])
            .select()
            .single()

        if (invoiceError || !invoice) {
            throw new Error(invoiceError?.message || "Failed to create invoice")
        }

        // Create Invoice Items
        const invoiceItems = items.map(item => ({
            invoiceId: invoice.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            variantId: item.variantId || null,
            characteristics: item.characteristics,
        }))

        const { error: itemsError } = await insforge.database
            .from('InvoiceItem')
            .insert(invoiceItems)

        if (itemsError) {
            throw new Error(itemsError.message)
        }

        // Register Initial Payment
        if (amountPaid && amountPaid > 0) {
            const paymentData = {
                invoiceId: invoice.id,
                amount: amountPaid,
                method: paymentMethod || "CASH",
                date: new Date().toISOString(),
                notes: "Pago Inicial / Abono"
            }
            await insforge.database.from('Payment').insert([paymentData])
        }

        // Update Stock
        for (const item of items) {
            await adjustInventoryStock(insforge, item, -item.quantity)
        }

        // Add to client history
        if (clientId) {
            await addClientHistoryEntry(
                clientId,
                "INVOICE_CREATED",
                `Factura creada por ${Number(total).toFixed(2)}`,
                { invoiceId: invoice.id, invoiceNumber: invoice.sequenceNumber }
            )
        }

        if (validated.data.sourceQuoteId) {
            await insforge.database
                .from('Quote')
                .update({ status: 'ACCEPTED' })
                .eq('id', validated.data.sourceQuoteId)
        }

        revalidatePath("/invoices")
        revalidatePath("/quotes")
        return { success: true, invoiceId: invoice.id }
    } catch (e) {
        console.error(e)
        return { success: false, error: "Failed to create invoice" }
    }
}

export async function getInvoices() {
    await requireAuth();

    const insforge = createServerClient()

    const { data: invoices, error } = await insforge.database
        .from('Invoice')
        .select(`
            *,
            client:Client(*),
            items:InvoiceItem(*),
            workOrder:WorkOrder(*)
        `)
        .order('createdAt', { ascending: false })

    if (error) {
        console.error(error)
        return []
    }

    return invoices.map(invoice => ({
        ...invoice,
        total: Number(invoice.total),
        balance: invoice.balance ? Number(invoice.balance) : 0,
        shippingCost: invoice.shippingCost ? Number(invoice.shippingCost) : 0,
        tax: invoice.tax ? Number(invoice.tax) : 0,
        discount: Number(invoice.discount ?? 0),
        hasNcf: invoice.hasNcf,
        items: (invoice.items || []).map((item: InvoiceItem) => ({
            ...item,
            quantity: Number(item.quantity),
            price: Number(item.price)
        }))
    }))
}

export async function getInvoiceById(id: string) {
    await requireAuth();

    const insforge = createServerClient()

    const { data: invoice, error } = await insforge.database
        .from('Invoice')
        .select(`
            *,
            client:Client(*),
            items:InvoiceItem(*),
            createdBy:users(*),
            dispatchInfo:Dispatch(
                *,
                technician:users(*)
            )
        `)
        .eq('id', id)
        .single()

    if (error || !invoice) {
        return null
    }

    // Enrich items with product unit info for display
    const normalizedItems: InvoiceItem[] = (invoice.items || []).map((item: InvoiceItem) => ({
        ...item,
        quantity: Number(item.quantity),
        price: Number(item.price)
    }))
    
    const productIds = [...new Set(normalizedItems.map(i => i.productId).filter(Boolean))] as string[]
    let productsMap: Record<string, { unitType: string; measurementUnit: string | null }> = {}
    
    if (productIds.length > 0) {
        const { data: products } = await insforge.database
            .from('Product')
            .select('id, unitType, measurementUnit')
            .in('id', productIds)
            
        if (products) {
            productsMap = products.reduce((acc, p) => ({
                ...acc,
                [p.id]: p
            }), {})
        }
    }

    const enrichedItems = normalizedItems.map(item => ({
        ...item,
        unitType: item.productId ? productsMap[item.productId]?.unitType : 'UNIT',
        measurementUnit: item.productId ? productsMap[item.productId]?.measurementUnit : null
    }))

    return {
        ...invoice,
        total: Number(invoice.total),
        balance: invoice.balance ? Number(invoice.balance) : 0,
        shippingCost: invoice.shippingCost ? Number(invoice.shippingCost) : 0,
        tax: invoice.tax ? Number(invoice.tax) : 0,
        discount: Number(invoice.discount ?? 0),
        hasNcf: invoice.hasNcf,
        items: enrichedItems
    }
}

export async function markAsDispatched(invoiceId: string, driverName?: string) {
    await requireAuth();

    const insforge = createServerClient()

    // Update invoice
    await insforge.database
        .from('Invoice')
        .update({ dispatched: true })
        .eq('id', invoiceId)

    // Create dispatch
    await insforge.database
        .from('Dispatch')
        .insert([{
            invoiceId: invoiceId,
            status: 'DELIVERED',
            driverName: driverName || 'Default Driver'
        }])

    revalidatePath("/dispatch")
}

export async function markAsPaid(invoiceId: string) {
    await requireAuth();

    const insforge = createServerClient()

    await insforge.database
        .from('Invoice')
        .update({ status: 'PAID' })
        .eq('id', invoiceId)

    revalidatePath("/receivables")
}

export async function deleteInvoice(id: string, password?: string) {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const insforge = createServerClient()

    // Get invoice with related data
    const { data: invoice } = await insforge.database
        .from('Invoice')
        .select('*')
        .eq('id', id)
        .single()

    if (!invoice) {
        return { success: false, error: "Factura no encontrada" }
    }

    if (user.role !== 'ADMIN') {
        return { success: false, error: "Solo el Administrador puede eliminar facturas." }
    }

    if (!password) {
        return { success: false, error: "Contraseña requerida" }
    }

    const { data: dbUser } = await insforge.database
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

    if (!dbUser || dbUser.password !== password) {
        return { success: false, error: "Contraseña incorrecta" }
    }

    try {
        // Get items to revert stock
        const { data: items } = await insforge.database
            .from('InvoiceItem')
            .select('*')
            .eq('invoiceId', id)

        if (items) {
            for (const item of items) {
                await adjustInventoryStock(insforge, item, item.quantity)
            }
        }

        // Delete WorkOrder if exists
        if (invoice.workOrder) {
            await insforge.database
                .from('WorkOrder')
                .delete()
                .eq('invoiceId', id)
        }

        // Delete Dispatch if exists
        if (invoice.dispatchInfo) {
            await insforge.database
                .from('Dispatch')
                .delete()
                .eq('invoiceId', id)
        }

        // Delete Invoice (Items will be deleted via Cascade)
        await insforge.database
            .from('Invoice')
            .delete()
            .eq('id', id)

        revalidatePath("/invoices")
        return { success: true }
    } catch (error) {
        console.error("Delete Invoice Error:", error)
        return { success: false, error: "Error al eliminar factura" }
    }
}

export async function updateInvoice(id: string, data: InvoiceFormData) {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
        throw new Error("Unauthorized: Only Admins can edit invoices")
    }

    const validated = InvoiceSchema.safeParse(data)
    if (!validated.success) {
        return { success: false, error: validated.error.message }
    }

    const { clientId, clientName, items, total, shippingCost, deliveryDate, notes } = validated.data
    const insforge = createServerClient()

    try {
        // Get old items
        const { data: oldItems } = await insforge.database
            .from('InvoiceItem')
            .select('*')
            .eq('invoiceId', id)

        // Revert old stock
        if (oldItems) {
            for (const item of oldItems) {
                await adjustInventoryStock(insforge, item, item.quantity)
            }
        }

        // Delete old items
        await insforge.database
            .from('InvoiceItem')
            .delete()
            .eq('invoiceId', id)

        // Update invoice
        await insforge.database
            .from('Invoice')
            .update({
                clientId,
                clientName,
                total,
                shippingCost: shippingCost || 0,
                deliveryDate: deliveryDate?.toISOString(),
                notes: notes,
                tax: validated.data.tax || 0,
                discount: validated.data.discount || 0,
                hasNcf: Number(validated.data.tax || 0) > 0,
            })
            .eq('id', id)

        // Create new items and deduct stock
        for (const item of items) {
            await adjustInventoryStock(insforge, item, -item.quantity)

            await insforge.database
                .from('InvoiceItem')
                .insert([{
                    invoiceId: id,
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    variantId: item.variantId || null,
                    characteristics: item.characteristics,
                }])
        }

        revalidatePath("/invoices")
        revalidatePath(`/invoices/${id}`)
        return { success: true }
    } catch (e) {
        console.error("Update Invoice Error:", e)
        return { success: false, error: (e as Error).message || "Failed to update invoice" }
    }
}
