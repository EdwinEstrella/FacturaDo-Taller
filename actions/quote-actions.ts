"use server"

import { db } from "@/lib/db"
import { quotes, quoteItems, clients, users, invoices, invoiceItems, products } from "@/db/schema"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"
import { eq, lte, desc, and } from "drizzle-orm"

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

    const total = data.items.reduce((acc, item) => acc + (item.price * item.quantity), 0)

    // Calcular fecha de vencimiento (15 días desde hoy)
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 15)

    try {
        const [quote] = await db.insert(quotes).values({
            clientId: data.clientId,
            total: total.toString(),
            createdById: user.id,
            status: "PENDING",
            validUntil: validUntil,
        }).returning()

        // Insert items
        for (const item of data.items) {
            await db.insert(quoteItems).values({
                quoteId: quote.id,
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                price: item.price.toString(),
            })
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
    // Primero verificar y marcar cotizaciones vencidas
    const now = new Date()
    await db.update(quotes)
        .set({ status: "EXPIRED" })
        .where(and(
            eq(quotes.status, "PENDING"),
            lte(quotes.validUntil, now)
        ))

    // Get all quotes with client and items
    const allQuotes = await db.select().from(quotes).orderBy(desc(quotes.createdAt))

    // Manually fetch relations for each quote
    const quotesWithRelations = await Promise.all(
        allQuotes.map(async (quote) => {
            const [client] = await db.select().from(clients).where(eq(clients.id, quote.clientId!)).limit(1)
            const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id))

            return {
                ...quote,
                total: Number(quote.total),
                client,
                items: items.map(item => ({
                    ...item,
                    price: Number(item.price)
                }))
            }
        })
    )

    return quotesWithRelations
}

export async function getQuoteById(id: string) {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1)

    if (!quote) return null

    const [client] = await db.select().from(clients).where(eq(clients.id, quote.clientId!)).limit(1)
    const [createdBy] = quote.createdById ? await db.select().from(users).where(eq(users.id, quote.createdById)).limit(1) : [null]
    const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id))

    return {
        ...quote,
        total: Number(quote.total),
        client,
        createdBy,
        items: items.map(item => ({
            ...item,
            price: Number(item.price)
        }))
    }
}

export async function convertQuoteToInvoice(quoteId: string) {
    const quote = await getQuoteById(quoteId)

    if (!quote) return { success: false, error: "Cotización no encontrada" }

    try {
        const [invoice] = await db.insert(invoices).values({
            clientId: quote.clientId,
            clientName: quote.client?.name || "Desde Cotización",
            total: quote.total.toString(),
            status: "PAID",
            paymentMethod: "CASH",
            createdById: quote.createdById,
            creatorName: quote.createdBy?.name,
        }).returning()

        // Insert invoice items
        for (const item of quote.items) {
            await db.insert(invoiceItems).values({
                invoiceId: invoice.id,
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                price: item.price.toString(),
            })
        }

        // Deduct stock
        for (const item of quote.items) {
            if (item.productId) {
                const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1)
                if (product && product.category !== "SERVICIO") {
                    await db.update(products)
                        .set({ stock: Math.max(0, product.stock - item.quantity) })
                        .where(eq(products.id, item.productId))
                }
            }
        }

        await db.update(quotes)
            .set({ status: "ACCEPTED" })
            .where(eq(quotes.id, quoteId))

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

    try {
        await db.delete(quotes).where(eq(quotes.id, quoteId))

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

    try {
        const now = new Date()

        const expiredQuotes = await db.select().from(quotes).where(
            and(
                eq(quotes.status, "PENDING"),
                lte(quotes.validUntil, now)
            )
        )

        for (const quote of expiredQuotes) {
            await db.update(quotes)
                .set({ status: "EXPIRED" })
                .where(eq(quotes.id, quote.id))
        }

        revalidatePath("/quotes")
        return { success: true, count: expiredQuotes.length }
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

    try {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const expiredQuotes = await db.select().from(quotes).where(
            and(
                eq(quotes.status, "EXPIRED"),
                lte(quotes.validUntil, thirtyDaysAgo)
            )
        )

        let count = 0
        for (const quote of expiredQuotes) {
            await db.delete(quotes).where(eq(quotes.id, quote.id))
            count++
        }

        revalidatePath("/quotes")
        return { success: true, count }
    } catch (error) {
        console.error("Error cleaning up expired quotes:", error)
        return { success: false, error: "Error al limpiar cotizaciones vencidas" }
    }
}
