"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export interface ClientHistoryEntry {
    id: string
    action: string
    description: string | null
    metadata: string | null
    createdAt: Date
}

/**
 * Registra una acción en el historial del cliente
 */
export async function addClientHistoryEntry(
    clientId: string,
    action: string,
    description?: string,
    metadata?: Record<string, unknown>
) {
    try {
        await prisma.clientHistory.create({
            data: {
                clientId,
                action,
                description,
                metadata: metadata ? JSON.stringify(metadata) : null,
            },
        })
        return { success: true }
    } catch (error) {
        console.error("Error adding client history:", error)
        return { success: false, error: "Error al agregar historial" }
    }
}

/**
 * Obtiene el historial de un cliente
 */
export async function getClientHistory(clientId: string): Promise<{
    success: boolean
    data?: ClientHistoryEntry[]
    error?: string
}> {
    try {
        const history = await prisma.clientHistory.findMany({
            where: { clientId },
            orderBy: { createdAt: "desc" },
            take: 100, // Últimas 100 acciones
        })

        return {
            success: true,
            data: history.map((h) => ({
                id: h.id,
                action: h.action,
                description: h.description,
                metadata: h.metadata,
                createdAt: h.createdAt,
            })),
        }
    } catch {
        return { success: false, error: "Error al obtener historial" }
    }
}

/**
 * Obtiene estadísticas del cliente
 */
export async function getClientStats(clientId: string) {
    try {
        const [invoiceCount, totalSpent, lastActivity] = await Promise.all([
            prisma.invoice.count({ where: { clientId } }),
            prisma.invoice.aggregate({
                where: { clientId, status: "PAID" },
                _sum: { total: true },
            }),
            prisma.clientHistory.findFirst({
                where: { clientId },
                orderBy: { createdAt: "desc" },
            }),
        ])

        return {
            success: true,
            data: {
                invoiceCount,
                totalSpent: Number(totalSpent._sum.total || 0),
                lastActivityDate: lastActivity?.createdAt,
            },
        }
    } catch {
        return { success: false, error: "Error al obtener estadísticas" }
    }
}
