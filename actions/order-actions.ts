"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createWorkOrder(invoiceId: string, notes: string) {
    try {
        const order = await prisma.workOrder.create({
            data: {
                invoiceId,
                notes,
                status: "PRODUCTION"
            }
        })
        revalidatePath("/orders")
        revalidatePath("/invoices")
        return { success: true, orderId: order.id }
    } catch (e) {
        console.error(e)
        return { success: false, error: "Error al crear orden de trabajo" }
    }
}

export async function updateWorkOrderStatus(id: number, status: string) {
    try {
        await prisma.workOrder.update({
            where: { id },
            data: { status }
        })
        revalidatePath("/orders")
        return { success: true }
    } catch {
        return { success: false, error: "Error al actualizar estado" }
    }
}

export async function getWorkOrders() {
    const workOrders = await prisma.workOrder.findMany({
        include: {
            invoice: {
                include: { items: true, client: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    // Serialize Decimal to number for client components
    return workOrders.map(order => ({
        ...order,
        invoice: order.invoice ? {
            ...order.invoice,
            total: Number(order.invoice.total),
            items: order.invoice.items.map(item => ({
                ...item,
                price: Number(item.price)
            }))
        } : null
    }))
}
