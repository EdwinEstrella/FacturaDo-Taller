"use server"

import { db } from "@/lib/db"
import { dailyCloses } from "@/db/schema"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/actions/auth-actions"
import { eq, desc, and, gte, lt } from "drizzle-orm"

interface InvoiceData {
    id: string
    sequenceNumber: number
    total: number
    paymentMethod: string
    createdAt: Date | string
    clientName: string | null
}

interface ExpenseData {
    id: string
    description: string | null
    amount: number
    date: Date | string
}

interface SaveDailyCloseData {
    closeDate: string // ISO date string
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

    try {
        // Convertir closeDate a Date (solo fecha, sin hora)
        const closeDate = new Date(data.closeDate)
        closeDate.setHours(0, 0, 0, 0)
        const nextDay = new Date(closeDate)
        nextDay.setDate(nextDay.getDate() + 1)

        // Verificar si ya existe un cierre para este día y este usuario
        const [existing] = await db.select()
            .from(dailyCloses)
            .where(
                and(
                    gte(dailyCloses.closeDate, closeDate),
                    lt(dailyCloses.closeDate, nextDay),
                    eq(dailyCloses.closedBy, user.id)
                )
            )
            .limit(1)

        const closeData = {
            closeDate,
            totalBilled: data.totalBilled.toString(),
            totalCollected: data.totalCollected.toString(),
            cashCollected: data.cashCollected.toString(),
            otherCollected: data.otherCollected.toString(),
            totalExpenses: data.totalExpenses.toString(),
            netCashInDrawer: data.netCashInDrawer.toString(),
            billBreakdownRD: data.billBreakdownRD || {},
            billBreakdownUSD: data.billBreakdownUSD || {},
            billBreakdownEUR: data.billBreakdownEUR || {},
            totalRD: data.totalRD.toString(),
            totalUSD: data.totalUSD.toString(),
            totalEUR: data.totalEUR.toString(),
            discrepancy: data.discrepancy.toString(),
            invoicesData: data.invoicesData,
            expensesData: data.expensesData,
            notes: data.notes || null,
        }

        if (existing) {
            // Actualizar el cierre existente
            await db.update(dailyCloses)
                .set(closeData)
                .where(eq(dailyCloses.id, existing.id))
        } else {
            // Crear nuevo cierre
            await db.insert(dailyCloses).values({
                ...closeData,
                closedBy: user.id,
                closedByName: user.name,
            })
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

    try {
        const history = await db.select()
            .from(dailyCloses)
            .orderBy(desc(dailyCloses.closeDate))
            .limit(50)

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

    try {
        const [dailyClose] = await db.select()
            .from(dailyCloses)
            .where(eq(dailyCloses.id, id))
            .limit(1)

        if (!dailyClose) {
            return { success: false, error: "Cierre no encontrado" }
        }

        return { success: true, dailyClose }
    } catch (error) {
        console.error("Error al obtener cierre:", error)
        return { success: false, error: "Error al obtener cierre" }
    }
}