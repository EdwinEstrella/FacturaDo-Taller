"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"
import { z } from "zod"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _QuoteItemSchema = z.object({
    productId: z.string(),
    productName: z.string(), // Snapshot name
    quantity: z.number().min(1),
    price: z.number().min(0),
})

/* const QuoteSchema = z.object({
    clientId: z.string(),
    items: z.array(QuoteItemSchema).min(1),
    total: z.number().min(0),
    // Add validity period etc. if needed
}) */

// Define QuoteFormData type based on the new createQuote function's data structure
type QuoteFormData = {
    clientId: string;
    // clientName: string; // Removed as it's not in schema
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

    try {
        const quote = await prisma.quote.create({
            data: {
                clientId: data.clientId,
                // clientName: data.clientName, // Removed
                total: total,
                createdById: user.id,
                status: "PENDING", // Re-added status as it was in the original schema
                items: {
                    create: data.items.map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        quantity: item.quantity,
                        price: item.price
                    }))
                }
            }
        })
        revalidatePath('/invoices')
        return { success: true, quote }
    } catch (error) {
        console.error("Error creating quote:", error)
        return { success: false, error: "Failed to create quote" }
    }
}

export async function getQuotes() {
    return await prisma.quote.findMany({
        include: {
            client: true,
            items: true // We might need items for summary or conversion
        },
        orderBy: { createdAt: 'desc' }
    })
}

export async function convertQuoteToInvoice(quoteId: string) {
    // Logic to convert:
    // 1. Get Quote
    // 2. Create Invoice with same items
    // 3. Mark Quote as ACCEPTED?

    const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: { items: true }
    })

    if (!quote) return { success: false, error: "Cotización no encontrada" }

    // Reuse logic or call createInvoice? 
    // Better to duplicate logic lightly or extract generic creator.
    // For simplicity, direct creation:

    try {
        const invoice = await prisma.invoice.create({
            data: {
                clientId: quote.clientId,
                clientName: "Desde Cotización", // Lookup client name if needed, or update schema to store it on Quote too
                total: quote.total,
                status: "PAID",
                paymentMethod: "CASH",
                items: {
                    create: quote.items.map(item => ({
                        productId: item.productId,
                        productName: "Item Cotizado", // Ideally fetch real name or store it in QuoteItem
                        quantity: item.quantity,
                        price: item.price
                    }))
                }
            }
        })

        // Deduct stock (simplified logic from invoice-actions)
        for (const item of quote.items) {
            if (item.productId) {
                const product = await prisma.product.findUnique({ where: { id: item.productId } })
                if (product && !product.isService) {
                    await prisma.product.update({
                        where: { id: item.productId },
                        data: { stock: { decrement: item.quantity } }
                    })
                }
            }
        }

        await prisma.quote.update({
            where: { id: quoteId },
            data: { status: "ACCEPTED" }
        })

        revalidatePath("/invoices")
        return { success: true, invoiceId: invoice.id }

    } catch (e) {
        console.error(e)
        return { success: false, error: "Error al convertir" }
    }
}
