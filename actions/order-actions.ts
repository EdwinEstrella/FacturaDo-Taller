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
    } catch (e) {
        return { success: false, error: "Error al actualizar estado" }
    }
}

export async function getWorkOrders() {
    return await prisma.workOrder.findMany({
        include: {
            invoice: {
                include: { items: true, client: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })
}
