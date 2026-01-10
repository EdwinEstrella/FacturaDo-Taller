"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
// import { redirect } from "next/navigation"
import { z } from "zod"
import { getCurrentUser } from "./auth-actions"
import { addClientHistoryEntry } from "./client-history-actions"

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

        // Agregar al historial del cliente
        if (clientId) {
            await addClientHistoryEntry(
                clientId,
                "INVOICE_CREATED",
                `Factura creada por ${Number(total).toFixed(2)}`,
                { invoiceId: invoice.id, invoiceNumber: invoice.sequenceNumber }
            )
        }

        revalidatePath("/invoices")
        return { success: true, invoiceId: invoice.id }
    } catch (e) {
        console.error(e)
        return { success: false, error: "Failed to create invoice" }
    }
}

export async function getInvoices() {
    const invoices = await prisma.invoice.findMany({
        include: {
            client: true,
            items: true,
            workOrder: true
        },
        orderBy: { createdAt: 'desc' }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return invoices.map((invoice: any) => ({
        ...invoice,
        total: Number(invoice.total),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (invoice.items || []).map((item: any) => ({
            ...item,
            price: Number(item.price)
        }))
    }))
}

export async function getInvoiceById(id: string) {
    const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
            client: true,
            items: true
        }
    })

    if (!invoice) return null

    return {
        ...invoice,
        total: Number(invoice.total),
        items: invoice.items.map(item => ({
            ...item,
            price: Number(item.price)
        }))
    }
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

// Update deleteInvoice signature
export async function deleteInvoice(id: string, password?: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    // Check if invoice exists and has a work order
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoice: any = await prisma.invoice.findUnique({
        where: { id },
        include: { workOrder: true, dispatchInfo: true }
    })

    if (!invoice) return { success: false, error: "Factura no encontrada" }

    // 1. Check permissions first
    // If it has a WorkOrder (Production), strictly require ADMIN
    const isProduction = !!invoice.workOrder
    if (isProduction && user.role !== 'ADMIN') {
        return { success: false, error: "Solo el Administrador puede eliminar facturas en Producción." }
    }

    // 2. Verify Password
    if (!password) {
        return { success: false, error: "Contraseña requerida" }
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })

    if (!dbUser || dbUser.password !== password) {
        return { success: false, error: "Contraseña incorrecta" }
    }

    try {
        // Transaction to ensure atomic deletion of dependent records
        await prisma.$transaction(async (tx) => {
            // 1. Revert Stock
            // Get items to restore stock
            const itemsToRevert = await tx.invoiceItem.findMany({
                where: { invoiceId: id }
            })

            for (const item of itemsToRevert) {
                if (item.productId) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } })
                    if (product && !product.isService) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { stock: { increment: item.quantity } }
                        })
                    }
                }
            }

            // 2. Delete WorkOrder if exists
            if (invoice.workOrder) {
                await tx.workOrder.delete({
                    where: { invoiceId: id }
                })
            }

            // 3. Delete Dispatch if exists
            if (invoice.dispatchInfo) {
                await tx.dispatch.delete({
                    where: { invoiceId: id }
                })
            }

            // 4. Delete Invoice (Items will be deleted via Cascade in schema, but good to be explicit or rely on schema)
            // Schema says: invoice   Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
            await tx.invoice.delete({
                where: { id }
            })
        })

        revalidatePath("/invoices")
        return { success: true }
    } catch (error) {
        console.error("Delete Invoice Error:", error)
        return { success: false, error: "Error al eliminar factura" }
    }
}

export async function updateInvoice(id: string, data: InvoiceFormData) {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') throw new Error("Unauthorized: Only Admins can edit invoices")

    // Validate data
    const validated = InvoiceSchema.safeParse(data)
    if (!validated.success) return { success: false, error: validated.error.message }

    const { clientId, clientName, items, total } = validated.data

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Revert Old Stock
            const oldItems = await tx.invoiceItem.findMany({ where: { invoiceId: id } })
            for (const item of oldItems) {
                if (item.productId) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } })
                    if (product && !product.isService) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { stock: { increment: item.quantity } }
                        })
                    }
                }
            }

            // 2. Delete Old Items
            await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })

            // 3. Update Invoice Details
            await tx.invoice.update({
                where: { id },
                data: {
                    clientId,
                    clientName,
                    total,
                    // Don't update sequenceNumber, createdBy, etc.
                }
            })

            // 4. Create New Items and Deduct Stock
            for (const item of items) {
                // Deduct Stock
                const product = await tx.product.findUnique({ where: { id: item.productId } })
                if (!product) throw new Error(`Product ${item.productId} not found`)

                if (!product.isService) {
                    if (product.stock < item.quantity) {
                        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`)
                    }
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { decrement: item.quantity } }
                    })
                }

                // Create Item
                await tx.invoiceItem.create({
                    data: {
                        invoiceId: id,
                        productId: item.productId,
                        productName: item.productName,
                        quantity: item.quantity,
                        price: item.price
                    }
                })
            }
        })

        revalidatePath("/invoices")
        revalidatePath(`/invoices/${id}`)
        return { success: true }
    } catch (e) {
        console.error("Update Invoice Error:", e)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return { success: false, error: (e as any).message || "Failed to update invoice" }
    }
}
