"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"
import { Database } from "@/lib/supabase/database.types"

type Quote = Database['public']['Tables']['Quote']['Row']
type QuoteInsert = Database['public']['Tables']['Quote']['Insert']
type QuoteItem = Database['public']['Tables']['QuoteItem']['Row']
type QuoteItemInsert = Database['public']['Tables']['QuoteItem']['Insert']

type QuoteFormData = {
    clientId: string;
    items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        price: number;
    }>;
};

export async function createQuote(data: QuoteFormData) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const supabase = await createClient()

    const total = data.items.reduce((acc, item) => acc + (item.price * item.quantity), 0)

    // Calculate expiration date (15 days from now)
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 15)

    try {
        const { data: quote, error: quoteError } = await supabase
            .from('Quote')
            .insert({
                clientId: data.clientId,
                total: total,
                createdById: user.id,
                status: "PENDING",
                validUntil: validUntil.toISOString(),
            })
            .select()
            .single()

        if (quoteError || !quote) {
            throw new Error(quoteError?.message || "Failed to create quote")
        }

        // Insert items
        const quoteItems = data.items.map(item => ({
            quoteId: quote.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
        }))

        const { error: itemsError } = await supabase
            .from('QuoteItem')
            .insert(quoteItems)

        if (itemsError) {
            throw itemsError
        }

        // Get full quote with relations
        const fullQuote = await getQuoteById(quote.id)

        revalidatePath('/invoices')

        return { success: true, quote: fullQuote }
    } catch (error) {
        console.error("Error creating quote:", error)
        return { success: false, error: "Failed to create quote" }
    }
}

export async function getQuotes() {
    const supabase = await createClient()

    // First, check and mark expired quotes
    const now = new Date().toISOString()

    await supabase
        .from('Quote')
        .update({ status: "EXPIRED" })
        .eq('status', "PENDING")
        .lte('validUntil', now)

    // Get all quotes with client and items
    const { data: quotes, error } = await supabase
        .from('Quote')
        .select(`
            *,
            client:Client(*),
            items:QuoteItem(*)
        `)
        .order('createdAt', { ascending: false })

    if (error) {
        console.error(error)
        return []
    }

    return (quotes || []).map(quote => ({
        ...quote,
        total: Number(quote.total),
        items: (quote.items || []).map((item: QuoteItem) => ({
            ...item,
            price: Number(item.price)
        }))
    }))
}

export async function getQuoteById(id: string) {
    const supabase = await createClient()

    const { data: quote, error } = await supabase
        .from('Quote')
        .select(`
            *,
            client:Client(*),
            createdBy:User(*),
            items:QuoteItem(*)
        `)
        .eq('id', id)
        .single()

    if (error || !quote) {
        return null
    }

    return {
        ...quote,
        total: Number(quote.total),
        items: (quote.items || []).map((item: QuoteItem) => ({
            ...item,
            price: Number(item.price)
        }))
    }
}

export async function convertQuoteToInvoice(quoteId: string) {
    const quote = await getQuoteById(quoteId)

    if (!quote) return { success: false, error: "Cotización no encontrada" }

    const supabase = await createClient()

    try {
        const { data: invoice, error: invoiceError } = await supabase
            .from('Invoice')
            .insert({
                clientId: quote.clientId,
                clientName: quote.client?.name || "Desde Cotización",
                total: quote.total,
                status: "PAID",
                paymentMethod: "CASH",
                createdById: quote.createdById,
                creatorName: quote.createdBy?.name,
                balance: 0,
                shippingCost: 0,
                tax: 0,
                hasNcf: false,
                dispatched: false,
            })
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
        }))

        const { error: itemsError } = await supabase
            .from('InvoiceItem')
            .insert(invoiceItems)

        if (itemsError) {
            throw itemsError
        }

        // Deduct stock
        for (const item of quote.items) {
            if (item.productId) {
                const { data: product } = await supabase
                    .from('Product')
                    .select('*')
                    .eq('id', item.productId)
                    .single()

                if (product && !product.isService) {
                    await supabase
                        .from('Product')
                        .update({ stock: Math.max(0, product.stock - item.quantity) })
                        .eq('id', item.productId)
                }
            }
        }

        await supabase
            .from('Quote')
            .update({ status: "ACCEPTED" })
            .eq('id', quoteId)

        revalidatePath("/invoices")
        return { success: true, invoiceId: invoice.id }

    } catch (e) {
        console.error(e)
        return { success: false, error: "Error al convertir" }
    }
}

export async function deleteQuote(quoteId: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const supabase = await createClient()

    try {
        const { error } = await supabase
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
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const supabase = await createClient()

    try {
        const now = new Date().toISOString()

        const { data: expiredQuotes, error } = await supabase
            .from('Quote')
            .select('id')
            .eq('status', "PENDING")
            .lte('validUntil', now)

        if (error) {
            throw error
        }

        await supabase
            .from('Quote')
            .update({ status: "EXPIRED" })
            .eq('status', "PENDING")
            .lte('validUntil', now)

        revalidatePath("/quotes")
        return { success: true, count: expiredQuotes?.length || 0 }
    } catch (error) {
        console.error("Error marking expired quotes:", error)
        return { success: false, error: "Error al marcar cotizaciones vencidas" }
    }
}

export async function cleanupExpiredQuotes() {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Unauthorized" }
    }

    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
        return { success: false, error: "No tienes permisos para eliminar cotizaciones" }
    }

    const supabase = await createClient()

    try {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: expiredQuotes, error } = await supabase
            .from('Quote')
            .select('id')
            .eq('status', "EXPIRED")
            .lte('validUntil', thirtyDaysAgo.toISOString())

        if (error) {
            throw error
        }

        if (expiredQuotes && expiredQuotes.length > 0) {
            const idsToDelete = expiredQuotes.map(q => q.id)
            await supabase
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
