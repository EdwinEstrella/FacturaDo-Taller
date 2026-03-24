"use server"

import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/actions/auth-actions"

interface InvoiceData {
    id: string
    sequenceNumber: number
    total: number
    paymentMethod: string
    createdAt: string
    clientName: string | null
}

interface ExpenseData {
    id: string
    description: string | null
    amount: number
    date: string
}

interface SaveDailyCloseData {
    closeDate: string
    totalBilled: number
    totalCollected: number
    cashCollected: number
    otherCollected: number
    totalExpenses: number
    netCashInDrawer: number
    billBreakdownRD?: Record<number, number>
    billBreakdownUSD?: Record<number, number>
    billBreakdownEUR?: Record<number, number>
    totalRD: number
    totalUSD: number
    totalEUR: number
    discrepancy: number
    invoicesData: InvoiceData[]
    expensesData: ExpenseData[]
    notes?: string
}

export async function saveDailyClose(data: SaveDailyCloseData) {
    const user = await getCurrentUser()

    if (!user) {
        return { success: false, error: "No autorizado" }
    }

    const insforge = createServerClient()

    try {
        const closeDate = new Date(data.closeDate)
        closeDate.setHours(0, 0, 0, 0)
        const nextDay = new Date(closeDate)
        nextDay.setDate(nextDay.getDate() + 1)

        // Check if close exists for this day and user
        const { data: existing } = await insforge.database
            .from('DailyClose')
            .select('id')
            .gte('closeDate', closeDate.toISOString())
            .lt('closeDate', nextDay.toISOString())
            .eq('closedBy', user.id)
            .single()

        const closeData = {
            closeDate: closeDate.toISOString(),
            totalBilled: data.totalBilled,
            totalCollected: data.totalCollected,
            cashCollected: data.cashCollected,
            otherCollected: data.otherCollected,
            totalExpenses: data.totalExpenses,
            netCashInDrawer: data.netCashInDrawer,
            billBreakdownRD: data.billBreakdownRD || {},
            billBreakdownUSD: data.billBreakdownUSD || {},
            billBreakdownEUR: data.billBreakdownEUR || {},
            totalRD: data.totalRD,
            totalUSD: data.totalUSD,
            totalEUR: data.totalEUR,
            discrepancy: data.discrepancy,
            invoicesData: data.invoicesData,
            expensesData: data.expensesData,
            notes: data.notes || null,
        }

        if (existing) {
            await insforge.database
                .from('DailyClose')
                .update(closeData)
                .eq('id', existing.id)
        } else {
            await insforge.database
                .from('DailyClose')
                .insert([{
                    ...closeData,
                    closedBy: user.id,
                    closedByName: user.name,
            }])
        }

        revalidatePath("/daily-close")
        revalidatePath("/daily-close-history")

        return { success: true }
    } catch (error) {
        console.error("Error al guardar cierre diario:", error)
        return { success: false, error: "Error al guardar el cierre" }
    }
}

export async function getDailyCloseHistory() {
    const user = await getCurrentUser()

    if (!user) {
        return { success: false, error: "No autorizado" }
    }

    const insforge = createServerClient()

    try {
        const { data: history, error } = await insforge.database
            .from('DailyClose')
            .select('*')
            .order('closeDate', { ascending: false })
            .limit(50)

        if (error) {
            throw error
        }

        return { success: true, history }
    } catch (error) {
        console.error("Error al obtener historial:", error)
        return { success: false, error: "Error al obtener historial" }
    }
}

export async function getDailyCloseById(id: string) {
    const user = await getCurrentUser()

    if (!user) {
        return { success: false, error: "No autorizado" }
    }

    const insforge = createServerClient()

    try {
        const { data: dailyClose, error } = await insforge.database
            .from('DailyClose')
            .select('*')
            .eq('id', id)
            .single()

        if (error || !dailyClose) {
            return { success: false, error: "Cierre no encontrado" }
        }

        return { success: true, dailyClose }
    } catch (error) {
        console.error("Error al obtener cierre:", error)
        return { success: false, error: "Error al obtener cierre" }
    }
}
