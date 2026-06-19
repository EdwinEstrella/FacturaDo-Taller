"use server"


import { requireAuth } from "@/actions/auth-actions";
import { createServerClient } from "@/lib/insforge/client"
import { isMeasuredMode } from "@/lib/product-measurements"
import type { QuoteItem, Client } from "@/types"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "./auth-actions"



const QuoteItemSchema = z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().positive(),
    price: z.number().min(0),
    variantId: z.string().optional(),
})

const QuoteSchema = z.object({
    clientId: z.string(),
    items: z.array(QuoteItemSchema).min(1),
    total: z.number().min(0),
    shippingCost: z.number().min(0).optional(),
    notes: z.string().optional(),
    tax: z.number().min(0).optional(),
    applyTax: z.boolean().optional(),
    isDraft: z.boolean().optional(),
})

type QuoteFormData = z.infer<typeof QuoteSchema>

type DatabaseClient = ReturnType<typeof createServerClient>

type QuoteInventoryItem = {
    productId: string | null
    productName: string
    quantity: number
    variantId?: string | null
}

function assertProductQuantityMode(product: { name?: string | null, unitType?: string | null, measurementUnit?: string | null }, quantity: number, fallbackName?: string) {
    if (!isMeasuredMode(product) && !Number.isInteger(quantity)) {
        throw new Error(`El producto ${fallbackName || product.name || "seleccionado"} solo permite cantidades enteras`)
    }
}

async function syncProductStockFromVariants(insforge: DatabaseClient, productId: string) {
    await insforge.database.rpc("sync_product_stock_from_variants", { p_product_id: productId })
}

async function deductQuoteItemStock(insforge: DatabaseClient, item: QuoteInventoryItem) {
    if (!item.productId) return

    const { data: product } = await insforge.database
        .from('Product')
        .select('*')
        .eq('id', item.productId)
        .single()

    if (!product) {
        throw new Error(`Producto no encontrado: ${item.productName}`)
    }

    assertProductQuantityMode(product, Number(item.quantity), item.productName)

    if (item.variantId) {
        const { data: variant } = await insforge.database
            .from('ProductVariant')
            .select('*')
            .eq('id', item.variantId)
            .single()

        if (!variant) {
            throw new Error(`Variante no encontrada: ${item.productName}`)
        }

        const nextStock = Number(variant.stock || 0) - item.quantity
        if (nextStock < 0) {
            throw new Error(`Stock insuficiente para ${item.productName}`)
        }

        await insforge.database
            .from('ProductVariant')
            .update({ stock: nextStock })
            .eq('id', item.variantId)

        await syncProductStockFromVariants(insforge, item.productId)
        return
    }

    if (product && !product.isService) {
        const nextStock = Number(product.stock || 0) - item.quantity
        if (nextStock < 0) {
            throw new Error(`Stock insuficiente para ${product.name}`)
        }

        await insforge.database
            .from('Product')
            .update({ stock: nextStock })
            .eq('id', item.productId)
    }
}

function normalizeQuoteItem(item: QuoteItem) {
    return {
        ...item,
        quantity: Number(item.quantity),
        price: Number(item.price),
    }
}

async function validateQuoteItems(insforge: DatabaseClient, items: QuoteInventoryItem[]) {
    for (const item of items) {
        if (!item.productId) continue

        const { data: product } = await insforge.database
            .from('Product')
            .select('name, unitType, measurementUnit')
            .eq('id', item.productId)
            .single()

        if (!product) {
            throw new Error(`Producto no encontrado: ${item.productName}`)
        }

        assertProductQuantityMode(product, Number(item.quantity), item.productName)
    }
}

function normalizeQuoteRecord<T extends Record<string, unknown>>(quote: T) {
    return {
        ...quote,
        total: Number(quote.total ?? 0),
        tax: Number(quote.tax ?? 0),
        shippingCost: Number(quote.shippingCost ?? 0),
        applyTax: Boolean(quote.applyTax),
        isDraft: Boolean(quote.isDraft),
    }
}

export async function createQuote(data: QuoteFormData) {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const validated = QuoteSchema.safeParse(data)

    if (!validated.success) {
        return { success: false, error: validated.error.message }
    }

    const insforge = createServerClient()

    // Calculate expiration date (15 days from now)
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 15)

    const isDraft = validated.data.isDraft ?? false

    try {
        await validateQuoteItems(insforge, validated.data.items)

        const { data: quote, error: quoteError } = await insforge.database
            .from('Quote')
            .insert([{
                clientId: validated.data.clientId,
                total: validated.data.total,
                createdById: user.id,
                status: "PENDING",
                validUntil: isDraft ? null : validUntil.toISOString(),
                notes: validated.data.notes,
                tax: validated.data.tax || 0,
                shippingCost: validated.data.shippingCost || 0,
                applyTax: validated.data.applyTax || false,
                isDraft,
            }])
            .select()
            .single()

        if (quoteError || !quote) {
            throw new Error(quoteError?.message || "Failed to create quote")
        }

        // Insert items
        const quoteItems = validated.data.items.map(item => ({
            quoteId: quote.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            variantId: item.variantId || null
        }))

        const { error: itemsError } = await insforge.database
            .from('QuoteItem')
            .insert(quoteItems)

        if (itemsError) {
            throw itemsError
        }

        // Get full quote with relations
        const fullQuote = await getQuoteById(quote.id)

        revalidatePath('/quotes')
        revalidatePath('/invoices')

        return { success: true, quote: fullQuote }
    } catch (error) {
        console.error("Error creating quote:", error)
        return { success: false, error: "Failed to create quote" }
    }
}

export async function getQuotes() {
    await requireAuth();

    const insforge = createServerClient()

    // First, check and mark expired quotes
    const now = new Date().toISOString()

    await insforge.database
        .from('Quote')
        .update({ status: "EXPIRED" })
        .eq('status', "PENDING")
        .eq('isDraft', false)
        .lte('validUntil', now)

    // Get quotes, items, and clients separately (Quote table lacks FKs in PostgREST,
    // so nested queries like items:QuoteItem(*) fail with PGRST200)
    const { data: quotes, error } = await insforge.database
        .from('Quote')
        .select('*')
        .order('createdAt', { ascending: false })

    if (error) {
        console.error(error)
        return []
    }

    // Fetch client data for each unique clientId
    const clientIds = [...new Set((quotes || []).map(q => q.clientId).filter(Boolean))]
    let clientsMap: Record<string, Client> = {}

    if (clientIds.length > 0) {
        const { data: clients } = await insforge.database
            .from('Client')
            .select('*')
            .in('id', clientIds)

        if (clients) {
            clientsMap = Object.fromEntries((clients as Client[]).map(c => [c.id, c]))
        }
    }

    // Fetch associated QuoteItems for all retrieved quotes
    const quoteIds = (quotes || []).map(q => q.id)
    let itemsMap: Record<string, QuoteItem[]> = {}

    if (quoteIds.length > 0) {
        const { data: items } = await insforge.database
            .from('QuoteItem')
            .select('*')
            .in('quoteId', quoteIds)

        if (items) {
            itemsMap = (items as QuoteItem[]).reduce((acc: Record<string, QuoteItem[]>, item: QuoteItem) => {
                if (!acc[item.quoteId]) {
                    acc[item.quoteId] = []
                }
                acc[item.quoteId].push(item)
                return acc
            }, {})
        }
    }

    return (quotes || []).map(quote => ({
        ...normalizeQuoteRecord(quote),
        client: quote.clientId ? clientsMap[quote.clientId] || null : null,
        items: (itemsMap[quote.id] || []).map(normalizeQuoteItem)
    }))
}

export async function getQuoteById(id: string) {
    await requireAuth();

    const insforge = createServerClient()

    const { data: quote, error } = await insforge.database
        .from('Quote')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !quote) {
        return null
    }

    const [{ data: items }, { data: client }, { data: createdBy }] = await Promise.all([
        insforge.database
            .from('QuoteItem')
            .select('*')
            .eq('quoteId', id),
        quote.clientId
            ? insforge.database
                .from('Client')
                .select('*')
                .eq('id', quote.clientId)
                .single()
            : Promise.resolve({ data: null }),
        quote.createdById
            ? insforge.database
                .from('users')
                .select('id, name, username, role')
                .eq('id', quote.createdById)
                .single()
            : Promise.resolve({ data: null }),
    ])

    // Enrich items with product unit info for display
    const normalizedItems = (items || []).map(normalizeQuoteItem)
    const productIds = [...new Set(normalizedItems.map(i => i.productId).filter(Boolean))] as string[]
    let productsMap: Record<string, { unitType: string; measurementUnit: string | null }> = {}

    if (productIds.length > 0) {
        const { data: products } = await insforge.database
            .from('Product')
            .select('id, unitType, measurementUnit')
            .in('id', productIds)

        if (products) {
            productsMap = Object.fromEntries(
                products.map((p: { id: string; unitType: string; measurementUnit: string | null }) => [p.id, { unitType: p.unitType, measurementUnit: p.measurementUnit }])
            )
        }
    }

    const enrichedItems = normalizedItems.map(item => {
        const product = item.productId ? productsMap[item.productId] : null
        return {
            ...item,
            unitType: product?.unitType ?? 'UNIT',
            measurementUnit: product?.measurementUnit ?? null,
        }
    })

    return {
        ...normalizeQuoteRecord(quote),
        client,
        createdBy,
        items: enrichedItems
    }
}

export async function convertQuoteToInvoice(quoteId: string) {
    await requireAuth();
    const quote = await getQuoteById(quoteId)

    if (!quote) return { success: false, error: "Cotización no encontrada" }

    const insforge = createServerClient()

    try {
        const { data: invoice, error: invoiceError } = await insforge.database
            .from('Invoice')
            .insert([{
                clientId: quote.clientId,
                clientName: quote.client?.name || "Desde Cotización",
                total: quote.total,
                status: "PAID",
                paymentMethod: "CASH",
                createdById: quote.createdById,
                creatorName: quote.createdBy?.name,
                balance: 0,
                shippingCost: quote.shippingCost || 0,
                tax: quote.tax || 0,
                hasNcf: false,
                dispatched: false,
                notes: quote.notes,
            }])
            .select()
            .single()

        if (invoiceError || !invoice) {
            throw new Error(invoiceError?.message || "Failed to create invoice")
        }

        // Insert invoice items
        const invoiceItems = quote.items.map((item: QuoteItem) => ({
            invoiceId: invoice.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            variantId: item.variantId || null,
        }))

        const { error: itemsError } = await insforge.database
            .from('InvoiceItem')
            .insert(invoiceItems)

        if (itemsError) {
            throw itemsError
        }

        // Deduct stock
        for (const item of quote.items) {
            await deductQuoteItemStock(insforge, item)
        }

        await insforge.database
            .from('Quote')
            .update({ status: "ACCEPTED", isDraft: false })
            .eq('id', quoteId)

        revalidatePath("/invoices")
        revalidatePath("/quotes")
        return { success: true, invoiceId: invoice.id }

    } catch (e) {
        console.error(e)
        return { success: false, error: "Error al convertir" }
    }
}

export async function deleteQuote(quoteId: string) {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const insforge = createServerClient()

    try {
        const { error } = await insforge.database
            .from('Quote')
            .delete()
            .eq('id', quoteId)

        if (error) {
            throw error
        }

        revalidatePath("/quotes")
        return { success: true }
    } catch (error) {
        console.error("Error deleting quote:", error)
        return { success: false, error: "Error al eliminar cotización" }
    }
}

export async function markExpiredQuotes() {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const insforge = createServerClient()

    try {
        const now = new Date().toISOString()

        const { data: expiredQuotes, error } = await insforge.database
            .from('Quote')
            .select('id')
            .eq('status', "PENDING")
            .eq('isDraft', false)
            .lte('validUntil', now)

        if (error) {
            throw error
        }

        await insforge.database
            .from('Quote')
            .update({ status: "EXPIRED" })
            .eq('status', "PENDING")
            .eq('isDraft', false)
            .lte('validUntil', now)

        revalidatePath("/quotes")
        return { success: true, count: expiredQuotes?.length || 0 }
    } catch (error) {
        console.error("Error marking expired quotes:", error)
        return { success: false, error: "Error al marcar cotizaciones vencidas" }
    }
}

export async function cleanupExpiredQuotes() {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Unauthorized" }
    }

    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
        return { success: false, error: "No tienes permisos para eliminar cotizaciones" }
    }

    const insforge = createServerClient()

    try {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: expiredQuotes, error } = await insforge.database
            .from('Quote')
            .select('id')
            .eq('status', "EXPIRED")
            .lte('validUntil', thirtyDaysAgo.toISOString())

        if (error) {
            throw error
        }

        if (expiredQuotes && expiredQuotes.length > 0) {
            const idsToDelete = expiredQuotes.map(q => q.id)
            await insforge.database
                .from('Quote')
                .delete()
                .in('id', idsToDelete)
        }

        revalidatePath("/quotes")
        return { success: true, count: expiredQuotes?.length || 0 }
    } catch (error) {
        console.error("Error cleaning up expired quotes:", error)
        return { success: false, error: "Error al limpiar cotizaciones vencidas" }
    }
}

export async function updateQuote(id: string, data: QuoteFormData) {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") throw new Error("Unauthorized")

    const validated = QuoteSchema.safeParse(data)

    if (!validated.success) {
        return { success: false, error: validated.error.message }
    }

    const insforge = createServerClient()

    try {
        await validateQuoteItems(insforge, validated.data.items)

        const { error: quoteError } = await insforge.database
            .from('Quote')
            .update({
                clientId: validated.data.clientId,
                total: validated.data.total,
                notes: validated.data.notes,
                tax: validated.data.tax || 0,
                shippingCost: validated.data.shippingCost || 0,
                applyTax: validated.data.applyTax || false,
                isDraft: validated.data.isDraft ?? false,
            })
            .eq('id', id)

        if (quoteError) {
            throw new Error(quoteError.message || "Failed to update quote")
        }

        // Delete existing items
        await insforge.database
            .from('QuoteItem')
            .delete()
            .eq('quoteId', id)

        // Insert new items
        const quoteItems = validated.data.items.map(item => ({
            quoteId: id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            variantId: item.variantId || null
        }))

        const { error: itemsError } = await insforge.database
            .from('QuoteItem')
            .insert(quoteItems)

        if (itemsError) {
            throw new Error(itemsError.message || "Failed to add quote items")
        }

        revalidatePath("/quotes")
        return { success: true }
    } catch (error) {
        console.error("Error updating quote:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update quote" }
    }
}
