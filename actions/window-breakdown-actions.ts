"use server"

import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"

export interface WindowBreakdownItem {
    id: number
    ancho: number
    alto: number
    resCabRiel?: number
    resLateral?: number
    resJambas?: number
    resCabAlfDiv?: number
    resVAnchoDiv?: number
    resVAltura?: number
}

export interface WindowBreakdownData {
    windowType: "P65" | "TRADICIONAL"
    clientId?: string
    clientName?: string
    technicianName?: string
    items: WindowBreakdownItem[]
}

export async function saveWindowBreakdown(data: WindowBreakdownData) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const insforge = createServerClient()

    try {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        const { error } = await insforge.database
            .from('WindowBreakdown')
            .insert([{
                id,
                windowType: data.windowType,
                clientId: data.clientId || null,
                clientName: data.clientName || null,
                technicianName: data.technicianName || null,
                createdById: user.id,
                createdByName: user.name || user.username,
                items: JSON.stringify(data.items),
                totalWindows: data.items.length,
                createdAt: now,
                printedAt: null,
                printedBy: null
            }])

        if (error) throw error

        revalidatePath('/desglose')
        return { success: true, id }
    } catch (error) {
        console.error("Error saving window breakdown:", error)
        return { success: false, error: "Error al guardar desglose" }
    }
}

export async function getWindowBreakdowns(windowType?: "P65" | "TRADICIONAL") {
    const insforge = createServerClient()

    try {
        let query = insforge.database
            .from('WindowBreakdown')
            .select('*')
            .order('createdAt', { ascending: false })

        if (windowType) {
            query = query.eq('windowType', windowType)
        }

        const { data, error } = await query

        if (error) throw error

        return data?.map(breakdown => ({
            ...breakdown,
            items: typeof breakdown.items === 'string' ? JSON.parse(breakdown.items) : breakdown.items
        })) || []
    } catch (error) {
        console.error("Error getting window breakdowns:", error)
        return []
    }
}

export async function markAsPrinted(breakdownId: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const insforge = createServerClient()

    try {
        const { error } = await insforge.database
            .from('WindowBreakdown')
            .update({
                printedAt: new Date().toISOString(),
                printedBy: user.name || user.username
            })
            .eq('id', breakdownId)

        if (error) throw error

        revalidatePath('/desglose')
        return { success: true }
    } catch (error) {
        console.error("Error marking as printed:", error)
        return { success: false, error: "Error al marcar como impreso" }
    }
}

export async function deleteWindowBreakdown(breakdownId: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const insforge = createServerClient()

    try {
        const { error } = await insforge.database
            .from('WindowBreakdown')
            .delete()
            .eq('id', breakdownId)

        if (error) throw error

        revalidatePath('/desglose')
        return { success: true }
    } catch (error) {
        console.error("Error deleting breakdown:", error)
        return { success: false, error: "Error al eliminar desglose" }
    }
}

export async function getPendingBreakdowns(clientName: string, technicianName: string, windowType: "P65" | "TRADICIONAL") {
    const insforge = createServerClient()

    try {
        const { data, error } = await insforge.database
            .from('WindowBreakdown')
            .select('*')
            .eq('clientName', clientName)
            .eq('technicianName', technicianName)
            .eq('windowType', windowType)
            .is('printedAt', null)
            .order('createdAt', { ascending: false })

        if (error) throw error

        return data?.map(breakdown => ({
            ...breakdown,
            items: typeof breakdown.items === 'string' ? JSON.parse(breakdown.items) : breakdown.items
        })) || []
    } catch (error) {
        console.error("Error getting pending breakdowns:", error)
        return []
    }
}

export async function deletePendingBreakdowns(clientName: string, technicianName: string, windowType: "P65" | "TRADICIONAL") {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const insforge = createServerClient()

    try {
        const { error } = await insforge.database
            .from('WindowBreakdown')
            .delete()
            .eq('clientName', clientName)
            .eq('technicianName', technicianName)
            .eq('windowType', windowType)
            .is('printedAt', null)

        if (error) throw error

        revalidatePath('/desglose')
        return { success: true }
    } catch (error) {
        console.error("Error deleting pending breakdowns:", error)
        return { success: false, error: "Error al eliminar desgloses pendientes" }
    }
}
