"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { getCurrentUser } from "./auth-actions"

const InvoiceItemSchema = z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().min(1),
    price: z.number().min(0),
})

const InvoiceSchema = z.object({
    clientId: z.string(),
    clientName: z.string().optional(),
    items: z.array(InvoiceItemSchema).min(1),
    total: z.number().min(0),
    paymentMethod: z.string().optional(),
    ncfType: z.string().optional(),
    // Add other fields as needed
})

type InvoiceFormData = z.infer<typeof InvoiceSchema>

export async function createInvoice(data: InvoiceFormData) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    // Validate data
    const validated = InvoiceSchema.safeParse(data)

    if (!validated.success) {
        return { success: false, error: validated.error.message }
    }

    // Validate stock (pre-check before creating invoice)
    for (const item of data.items) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } })
        if (!product) {
            return { success: false, error: `Product with ID ${item.productId} not found.` }
        }
        if (!product.isService && product.stock < item.quantity) {
            return { success: false, error: `Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}` }
        }
    }

    const { clientId, clientName, items, total, paymentMethod } = validated.data

    try {
        // 1. Create Invoice
        const invoice = await prisma.invoice.create({
            data: {
                clientId: clientId,
                clientName: clientName, // Snapshot
                total: total,
                status: "PAID", // Direct invoice acts as POS sale usually
                paymentMethod: paymentMethod,
                createdById: user.id,
                items: {
                    create: items.map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        quantity: item.quantity,
                        price: item.price
                    }))
                }
            }
        })

        // 2. Update Stock
        for (const item of items) {
            // Check if product is service
            const product = await prisma.product.findUnique({ where: { id: item.productId } })
            if (product && !product.isService) {
                await prisma.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } }
                })
            }
        }

        revalidatePath("/invoices")
        return { success: true, invoiceId: invoice.id }
    } catch (e) {
        console.error(e)
        return { success: false, error: "Failed to create invoice" }
    }
}

export async function getInvoices() {
    return await prisma.invoice.findMany({
        include: {
            client: true,
            items: true,
            workOrder: true
        },
        orderBy: { createdAt: 'desc' }
    })
}

export async function getInvoiceById(id: string) {
    return await prisma.invoice.findUnique({
        where: { id },
        include: {
            client: true,
            items: true
        }
    })
}

export async function markAsDispatched(invoiceId: string, driverName?: string) {
    await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
            dispatched: true,
            dispatchInfo: {
                create: {
                    status: 'DELIVERED',
                    driverName: driverName || 'Default Driver'
                }
            }
        }
    })
    revalidatePath("/dispatch")
}

export async function markAsPaid(invoiceId: string) {
    await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID' }
    })
    revalidatePath("/receivables")
}
