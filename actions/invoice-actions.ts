"use server"

import { requireAuth } from "@/actions/auth-actions"
import { createServerClient } from "@/lib/insforge/client"
import { isMeasuredMode } from "@/lib/product-measurements"
import { computeEcfTotals, computeNoReceiptTotals, totalsDrift } from "@/lib/fiscal/issuance/totals"
import {
    buildInvoiceSnapshotInput,
    enqueueInvoiceEcf,
    loadFiscalMode,
    loadIssuer,
    mapIssuanceErrorToSpanish,
} from "@/lib/fiscal/issuance/invoice-issuance"
import { isServiceProduct } from "@/lib/fiscal/issuance/buyer"
import { IssuanceError } from "@/lib/fiscal/issuance/errors"
import { buildInvoiceEcfXml } from "@/lib/fiscal/issuance/mapper"
import {
    isPaymentMethod,
    type InvoiceLineSnapshot,
    type ComputedEcfTotals,
    type InvoiceSnapshot,
    type IssuerSnapshot,
    type StoredInvoiceEcfSnapshot,
} from "@/lib/fiscal/issuance/types"
import type { InvoiceItem, InvoicePayment } from "@/types"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "./auth-actions"
import { addClientHistoryEntry } from "./client-history-actions"

interface ProductRow {
    id: string
    name: string
    isService: boolean | null
    category: string | null
}

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
    withoutFiscalReceipt: z.boolean().optional(),
    applyTax: z.boolean().optional(),
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

        if (variant) {
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
        // Fallback to product-level stock if variant was deleted from catalog
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

            if (variant) {
                if (Number(variant.stock || 0) < item.quantity) {
                    throw new Error(`Insufficient stock for variant ${item.productName || variant.name}. Available: ${variant.stock}, Requested: ${item.quantity}`)
                }
                continue
            }
            // Fallback to product-level stock check if variant was deleted from catalog
        }

        if (!product.isService && Number(product.stock || 0) < item.quantity) {
            throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`)
        }
    }
}

/** Gross of the non-service lines, the ITBIS base of a "Sin comprobante" sale with ITBIS applied. */
async function taxableItemsGross(
    insforge: DatabaseClient,
    items: Array<{ productId: string; price: number; quantity: number }>
): Promise<number> {
    const productIds = [...new Set(items.map((item) => item.productId))]
    const { data, error } = await insforge.database
        .from('Product')
        .select('id, isService, category')
        .in('id', productIds)
    if (error || !data) throw new Error(error?.message || "Product lookup failed")

    const products = new Map<string, Pick<ProductRow, "isService" | "category">>(
        data.map((p: Pick<ProductRow, "id" | "isService" | "category">) => [p.id, p])
    )
    return items.reduce((sum, item) => {
        if (isServiceProduct(products.get(item.productId))) return sum
        return sum + Number(item.price) * Number(item.quantity || 0)
    }, 0)
}

export async function getInvoiceFiscalMode(): Promise<{ ecfEnabled: boolean }> {
    return loadFiscalMode()
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

    // Verificar si hay un turno de caja abierto (Bloqueo Bistro / POS)
    const { data: openShifts } = await insforge.database
        .from('CashShift')
        .select('id')
        .eq('status', 'OPEN')
        .limit(1)

    if (!openShifts || openShifts.length === 0) {
        return { success: false, error: "No se puede facturar: Es obligatorio realizar la apertura de caja primero." }
    }

    try {
        await validateInventoryAvailability(insforge, data.items)
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Stock validation failed" }
    }

    const { clientId, clientName, items, total, paymentMethod, shippingCost, deliveryDate, notes, amountPaid, withoutFiscalReceipt } = validated.data

    const { ecfEnabled } = await loadFiscalMode()
    const isWithoutFiscalReceipt = Boolean(withoutFiscalReceipt)

    let finalTax = validated.data.tax || 0
    let finalTotal = total
    let finalHasNcf = Number(validated.data.tax || 0) > 0
    let storedSnapshot: StoredInvoiceEcfSnapshot | null = null
    let ecfTypeToIssue: "E31" | "E32" | null = null

    if (isWithoutFiscalReceipt) {
        const itemsGross = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity || 0)), 0)
        let itbisBase: number | null = null
        if (validated.data.applyTax) {
            try {
                itbisBase = await taxableItemsGross(insforge, items)
            } catch {
                return { success: false, error: "Error al cargar los productos para calcular el ITBIS." }
            }
        }
        const noReceipt = computeNoReceiptTotals(itemsGross, {
            shipping: shippingCost || 0,
            discount: validated.data.discount || 0,
            itbisBase,
        })

        if (totalsDrift({ total, tax: validated.data.tax }, { total: noReceipt.total, tax: noReceipt.tax })) {
            return { success: false, error: "Los montos de la factura cambiaron. Revise la factura e intente de nuevo." }
        }

        finalTax = noReceipt.tax
        finalTotal = noReceipt.total
        finalHasNcf = false
    } else if (ecfEnabled) {
        if (!isPaymentMethod(paymentMethod)) {
            return { success: false, error: "Método de pago no válido para comprobantes fiscales." }
        }

        // 1. Load issuer BEFORE inserting anything
        let issuer: IssuerSnapshot
        try {
            issuer = await loadIssuer()
        } catch (err) {
            return { success: false, error: mapIssuanceErrorToSpanish(err) }
        }

        // 2. Load client BEFORE inserting anything
        let clientData: { id: string; name?: string | null; rnc?: string | null; cedula?: string | null; address?: string | null; phone?: string | null; email?: string | null } | null = null
        if (clientId) {
            const { data: clientRes, error: clientErr } = await insforge.database
                .from('Client')
                .select('id, name, rnc, cedula, address, phone, email')
                .eq('id', clientId)
                .single()
            if (clientErr || !clientRes) {
                return { success: false, error: "Cliente no encontrado." }
            }
            clientData = clientRes
        }

        // 3. Load products BEFORE inserting anything (typed rows, no placeholders)
        const productIds = [...new Set(items.map(i => i.productId))]
        const { data: dbProducts, error: prodErr } = await insforge.database
            .from('Product')
            .select('id, name, isService, category')
            .in('id', productIds)

        if (prodErr || !dbProducts) {
            return { success: false, error: "Error al cargar los productos para validar montos fiscales." }
        }

        const productMap = new Map<string, ProductRow>(dbProducts.map((p: ProductRow) => [p.id, p]))
        for (const item of items) {
            if (!productMap.has(item.productId)) {
                return { success: false, error: "Uno o más productos no existen en la base de datos." }
            }
        }

        const mapperLines: InvoiceLineSnapshot[] = items.map((item) => {
            const dbProd = productMap.get(item.productId)!
            const isService = isServiceProduct(dbProd)
            return {
                name: (item.productName || dbProd.name).trim(),
                quantity: Number(item.quantity),
                unitPrice: Number(item.price),
                taxable: !isService,
                isService,
            }
        })

        let computedTotals: ComputedEcfTotals
        try {
            computedTotals = computeEcfTotals(mapperLines, {
                shipping: shippingCost || 0,
                discount: validated.data.discount || 0,
            })
        } catch (err) {
            return { success: false, error: mapIssuanceErrorToSpanish(err) }
        }

        if (totalsDrift({ total, tax: validated.data.tax }, { total: computedTotals.totalAmount, tax: computedTotals.itbisAmount })) {
            return { success: false, error: "Los montos de la factura cambiaron. Revise la factura e intente de nuevo." }
        }

        const now = new Date()
        const snapshotInput = buildInvoiceSnapshotInput({
            items: items.map((item) => {
                const dbProd = productMap.get(item.productId)!
                return {
                    name: (item.productName || dbProd.name).trim(),
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.price),
                    isService: isServiceProduct(dbProd),
                }
            }),
            client: clientData,
            payment: {
                method: paymentMethod,
            },
            shipping: shippingCost || 0,
            discount: validated.data.discount || 0,
            issuedAt: now,
            totals: {
                taxableAmount: computedTotals.taxableAmount,
                exemptAmount: computedTotals.exemptAmount,
                itbis: computedTotals.itbisAmount,
                total: computedTotals.totalAmount,
            },
        })

        // Read active sequence to validate availability and get real expiresOn for dry-run
        const { data: seqRow, error: seqErr } = await insforge.database
            .from('EcfSequence')
            .select('ecfType, rangeStart, rangeEnd, nextNumber, expiresOn, active')
            .eq('ecfType', snapshotInput.ecfType)
            .maybeSingle()

        if (seqErr || !seqRow || !seqRow.active) {
            return { success: false, error: mapIssuanceErrorToSpanish(new IssuanceError("ECF_SEQUENCE_NOT_CONFIGURED")) }
        }

        const todaySd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo' }).format(now)
        const expiresOn = String(seqRow.expiresOn).slice(0, 10)
        if (expiresOn < todaySd) {
            return { success: false, error: mapIssuanceErrorToSpanish(new IssuanceError("ECF_SEQUENCE_EXPIRED")) }
        }

        if (Number(seqRow.nextNumber) > Number(seqRow.rangeEnd)) {
            return { success: false, error: mapIssuanceErrorToSpanish(new IssuanceError("ECF_SEQUENCE_EXHAUSTED")) }
        }

        // Dry-run XML build with placeholder e-NCF and real expiresOn to validate all mapper rules BEFORE reserving or inserting
        const placeholderEncf = snapshotInput.ecfType === "E31" ? "E310000000001" : "E320000000001"
        const dryRunInvoice: InvoiceSnapshot = {
            ...snapshotInput.invoice,
            encf: placeholderEncf,
            sequenceExpiresOn: seqRow.expiresOn,
        }

        try {
            buildInvoiceEcfXml(issuer, dryRunInvoice, now)
        } catch (err) {
            return { success: false, error: mapIssuanceErrorToSpanish(err) }
        }

        storedSnapshot = {
            issuer,
            invoice: snapshotInput.invoice,
        }
        ecfTypeToIssue = snapshotInput.ecfType

        finalTax = computedTotals.itbisAmount
        finalTotal = computedTotals.totalAmount
        finalHasNcf = true
    } else if (finalTax > 0) {
        // Legacy NCF mode: a taxed sale gets a B01 (crédito fiscal) NCF from the DB trigger, which requires a buyer RNC.
        if (!clientId) {
            return { success: false, error: "Para emitir comprobante fiscal seleccione un cliente con RNC." }
        }
        const { data: buyer } = await insforge.database
            .from('Client')
            .select('rnc')
            .eq('id', clientId)
            .single()
        if (!buyer?.rnc || !String(buyer.rnc).trim()) {
            return { success: false, error: "El cliente no tiene RNC. Agregue el RNC del cliente para emitir comprobante fiscal (B01)." }
        }
    }

    const isCredit = paymentMethod === "CREDIT"

    let status = "PAID"
    let balance = 0

    if (isCredit) {
        status = "PENDING"
        balance = finalTotal
    } else if (amountPaid !== undefined && amountPaid < finalTotal) {
        status = "PENDING"
        balance = finalTotal - amountPaid
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
                total: finalTotal,
                status: status,
                paymentMethod: paymentMethod,
                shippingCost: shippingCost || 0,
                deliveryDate: deliveryDate?.toISOString(),
                notes: notes,
                balance: balance,
                tax: finalTax,
                discount: validated.data.discount || 0,
                hasNcf: finalHasNcf,
                createdById: user.id,
                sequenceNumber: nextSequence
            }])
            .select()
            .single()

        if (invoiceError || !invoice) {
            throw new Error(invoiceError?.message || "Failed to create invoice")
        }

        // Create Invoice Items
        const invoiceItems = await Promise.all(items.map(async (item) => {
            let validVariantId = item.variantId || null
            if (validVariantId) {
                const { data: variant } = await insforge.database
                    .from('ProductVariant')
                    .select('id')
                    .eq('id', validVariantId)
                    .single()
                if (!variant) {
                    validVariantId = null
                }
            }
            return {
                invoiceId: invoice.id,
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                price: item.price,
                variantId: validVariantId,
                characteristics: item.characteristics,
            }
        }))

        const { error: itemsError } = await insforge.database
            .from('InvoiceItem')
            .insert(invoiceItems)

        if (itemsError) {
            throw new Error(itemsError.message)
        }

        let issuedEncf: string | undefined = undefined

        // If e-CF enabled and with receipt, enqueue e-CF before payments and stock
        if (ecfEnabled && !isWithoutFiscalReceipt && storedSnapshot && ecfTypeToIssue) {
            try {
                const reservation = await enqueueInvoiceEcf(invoice.id, ecfTypeToIssue, storedSnapshot)
                issuedEncf = reservation.encf
            } catch (err) {
                // Delete inserted items and invoice on issuance failure
                await insforge.database.from('InvoiceItem').delete().eq('invoiceId', invoice.id)
                await insforge.database.from('Invoice').delete().eq('id', invoice.id)
                return { success: false, error: mapIssuanceErrorToSpanish(err) }
            }
        }

        // Register Initial Payment. Lo que exceda el total es la devuelta: no se queda en caja.
        // Si no se digitó el monto recibido en una venta de contado, se cobró el total.
        const paidAmount = isCredit ? 0 : Math.min(amountPaid ?? finalTotal, finalTotal)
        if (paidAmount > 0) {
            const paymentData = {
                invoiceId: invoice.id,
                amount: paidAmount,
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
                `Factura creada por ${Number(finalTotal).toFixed(2)}`,
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
        return { success: true, invoiceId: invoice.id, encf: issuedEncf }
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
            workOrder:WorkOrder(*),
            dispatchInfo:Dispatch(
                *,
                technician:users(id, name, username, role)
            )
        `)
        .order('createdAt', { ascending: false })

    if (error) {
        console.error(error)
        return []
    }
    
    const allItems = (invoices || []).flatMap(inv => inv.items || [])
    const productIds = [...new Set(allItems.reduce<string[]>((acc, i: { productId?: string | null }) => {
        if (i.productId) acc.push(i.productId)
        return acc
    }, []))]
    
    let productsMap: Record<string, { unitType: string; measurementUnit: string | null }> = {}
    if (productIds.length > 0) {
        const { data: products } = await insforge.database
            .from('Product')
            .select('id, unitType, measurementUnit')
            .in('id', productIds)
            
        if (products) {
            productsMap = Object.fromEntries(products.map(p => [p.id, p]))
        }
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
            price: Number(item.price),
            unitType: item.productId ? productsMap[item.productId]?.unitType : 'UNIT',
            measurementUnit: item.productId ? productsMap[item.productId]?.measurementUnit : null
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
            createdBy:users(id, name, username, role),
            dispatchInfo:Dispatch(
                *,
                technician:users(id, name, username, role)
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
    const productIds = [...new Set(normalizedItems.reduce<string[]>((acc, i) => {
        if (i.productId) acc.push(i.productId)
        return acc
    }, []))]
    let productsMap: Record<string, { unitType: string; measurementUnit: string | null }> = {}

    if (productIds.length > 0) {
        const { data: products } = await insforge.database
            .from('Product')
            .select('id, unitType, measurementUnit')
            .in('id', productIds)

        if (products) {
            productsMap = Object.fromEntries(products.map(p => [p.id, p]))
        }
    }

    const enrichedItems = normalizedItems.map(item => ({
        ...item,
        unitType: item.productId ? productsMap[item.productId]?.unitType : 'UNIT',
        measurementUnit: item.productId ? productsMap[item.productId]?.measurementUnit : null
    }))

    let payments: InvoicePayment[] = []
    try {
        const { data: paymentRows, error: paymentsError } = await insforge.database
            .from('Payment')
            .select('id, amount, method, reference, date, createdAt')
            .eq('invoiceId', id)
            .order('date', { ascending: true })

        if (paymentsError) {
            console.error(`Failed to load payments for invoice ${id}:`, paymentsError)
        } else if (paymentRows) {
            payments = paymentRows.map((payment: {
                id: string
                amount: number | string
                method: string
                reference?: string | null
                date?: string | null
                createdAt?: string | null
            }) => ({
                id: payment.id,
                amount: Number(payment.amount),
                method: payment.method,
                reference: payment.reference ?? null,
                date: payment.date || payment.createdAt || ''
            }))
        }
    } catch (err) {
        console.error(`Unexpected error loading payments for invoice ${id}:`, err)
    }

    return {
        ...invoice,
        total: Number(invoice.total),
        balance: invoice.balance ? Number(invoice.balance) : 0,
        shippingCost: invoice.shippingCost ? Number(invoice.shippingCost) : 0,
        tax: invoice.tax ? Number(invoice.tax) : 0,
        discount: Number(invoice.discount ?? 0),
        hasNcf: invoice.hasNcf,
        items: enrichedItems,
        payments
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

    const { ecfEnabled } = await loadFiscalMode()
    const isLocked = Boolean(invoice.fiscalDocumentId || (ecfEnabled && invoice.ncf))
    if (isLocked) {
        return { success: false, error: "Esta factura tiene comprobante fiscal. Para corregirla emita una nota de crédito." }
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
        const { data: existingInvoice } = await insforge.database
            .from('Invoice')
            .select('id, fiscalDocumentId, ncf')
            .eq('id', id)
            .single()

        if (!existingInvoice) {
            return { success: false, error: "Factura no encontrada" }
        }

        const { ecfEnabled } = await loadFiscalMode()
        const isLocked = Boolean(existingInvoice.fiscalDocumentId || (ecfEnabled && existingInvoice.ncf))
        if (isLocked) {
            return { success: false, error: "Esta factura tiene comprobante fiscal. Para corregirla emita una nota de crédito." }
        }

        let updateTax = validated.data.tax || 0
        let updateHasNcf = Number(validated.data.tax || 0) > 0
        let updateTotal = total

        if (ecfEnabled) {
            const itemsGross = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity || 0)), 0)
            let itbisBase: number | null = null
            if (validated.data.applyTax) {
                try {
                    itbisBase = await taxableItemsGross(insforge, items)
                } catch {
                    return { success: false, error: "Error al cargar los productos para calcular el ITBIS." }
                }
            }
            const noReceipt = computeNoReceiptTotals(itemsGross, {
                shipping: shippingCost || 0,
                discount: validated.data.discount || 0,
                itbisBase,
            })
            if (totalsDrift({ total, tax: validated.data.tax }, { total: noReceipt.total, tax: noReceipt.tax })) {
                return { success: false, error: "Los montos de la factura cambiaron. Revise la factura e intente de nuevo." }
            }
            updateTax = noReceipt.tax
            updateHasNcf = false
            updateTotal = noReceipt.total
        }

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
                total: updateTotal,
                shippingCost: shippingCost || 0,
                deliveryDate: deliveryDate?.toISOString(),
                notes: notes,
                tax: updateTax,
                discount: validated.data.discount || 0,
                hasNcf: updateHasNcf,
            })
            .eq('id', id)

        // Create new items and deduct stock
        for (const item of items) {
            await adjustInventoryStock(insforge, item, -item.quantity)

            let validVariantId = item.variantId || null
            if (validVariantId) {
                const { data: variant } = await insforge.database
                    .from('ProductVariant')
                    .select('id')
                    .eq('id', validVariantId)
                    .single()
                if (!variant) {
                    validVariantId = null
                }
            }

            await insforge.database
                .from('InvoiceItem')
                .insert([{
                    invoiceId: id,
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    variantId: validVariantId,
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
