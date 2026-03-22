"use server"

import { db } from "@/lib/db"
import { clientHistory, invoices } from "@/db/schema"
import { eq, desc, sql, and } from "drizzle-orm"

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
        await db.insert(clientHistory).values({
            clientId,
            action,
            description,
            metadata: metadata ? JSON.stringify(metadata) : null,
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
        const history = await db.select()
            .from(clientHistory)
            .where(eq(clientHistory.clientId, clientId))
            .orderBy(desc(clientHistory.createdAt))
            .limit(100)

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
        // Get invoice count
        const invoiceCountResult = await db.select({ count: sql<number>`count(*)::int` })
            .from(invoices)
            .where(eq(invoices.clientId, clientId))

        const invoiceCount = invoiceCountResult[0]?.count || 0

        // Get total spent
        const totalSpentResult = await db.select({
            total: sql<number>`coalesce(sum(cast(${invoices.total} as numeric)), 0)`
        })
            .from(invoices)
            .where(and(
                eq(invoices.clientId, clientId),
                eq(invoices.status, "PAID")
            ))

        const totalSpent = Number(totalSpentResult[0]?.total || 0)

        // Get last activity
        const [lastActivity] = await db.select()
            .from(clientHistory)
            .where(eq(clientHistory.clientId, clientId))
            .orderBy(desc(clientHistory.createdAt))
            .limit(1)

        return {
            success: true,
            data: {
                invoiceCount,
                totalSpent,
                lastActivityDate: lastActivity?.createdAt,
            },
        }
    } catch {
        return { success: false, error: "Error al obtener estadísticas" }
    }
}
