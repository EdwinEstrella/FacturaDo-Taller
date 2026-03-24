"use server"

import { createServerClient } from "@/lib/insforge/client"



export interface ClientHistoryEntry {
    id: string
    action: string
    description: string | null
    metadata: string | null
    createdAt: string
}

export async function addClientHistoryEntry(
    clientId: string,
    action: string,
    description?: string,
    metadata?: Record<string, unknown>
) {
    const insforge = createServerClient()

    try {
        const { error } = await insforge.database
            .from('ClientHistory')
            .insert([{
                clientId,
                action,
                description,
                metadata: metadata ? JSON.stringify(metadata) : null,
            }])

        if (error) {
            throw error
        }

        return { success: true }
    } catch (error) {
        console.error("Error adding client history:", error)
        return { success: false, error: "Error al agregar historial" }
    }
}

export async function getClientHistory(clientId: string): Promise<{
    success: boolean
    data?: ClientHistoryEntry[]
    error?: string
}> {
    const insforge = createServerClient()

    try {
        const { data: history, error } = await insforge.database
            .from('ClientHistory')
            .select('*')
            .eq('clientId', clientId)
            .order('createdAt', { ascending: false })
            .limit(100)

        if (error) {
            throw error
        }

        return {
            success: true,
            data: (history || []).map((h) => ({
                id: h.id,
                action: h.action,
                description: h.description,
                metadata: h.metadata,
                createdAt: h.createdAt,
            })),
        }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Error al obtener historial" }
    }
}

export async function getClientStats(clientId: string) {
    const insforge = createServerClient()

    try {
        // Get invoice count
        const { count: invoiceCount, error: countError } = await insforge.database
            .from('Invoice')
            .select('*', { count: 'exact', head: true })
            .eq('clientId', clientId)

        if (countError) {
            throw countError
        }

        // Get total spent from paid invoices
        const { data: invoices, error: totalError } = await insforge.database
            .from('Invoice')
            .select('total')
            .eq('clientId', clientId)
            .eq('status', 'PAID')

        if (totalError) {
            throw totalError
        }

        const totalSpent = (invoices || []).reduce((sum, inv) => sum + Number(inv.total), 0)

        // Get last activity
        const { data: lastActivity, error: historyError } = await insforge.database
            .from('ClientHistory')
            .select('createdAt')
            .eq('clientId', clientId)
            .order('createdAt', { ascending: false })
            .limit(1)
            .single()

        return {
            success: true,
            data: {
                invoiceCount: invoiceCount || 0,
                totalSpent,
                lastActivityDate: lastActivity?.createdAt,
            },
        }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Error al obtener estadísticas" }
    }
}
