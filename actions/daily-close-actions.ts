"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/actions/auth-actions"
import { Prisma } from "@prisma/client"

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

        // Verificar si ya existe un cierre para este día y este usuario
        const existing = await prisma.dailyClose.findFirst({
            where: {
                closeDate,
                closedBy: user.id
            }
        })

        if (existing) {
            // Actualizar el cierre existente
            await prisma.dailyClose.update({
                where: { id: existing.id },
                data: {
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
                    invoicesData: data.invoicesData as unknown as Prisma.InputJsonObject,
                    expensesData: data.expensesData as unknown as Prisma.InputJsonObject,
                    notes: data.notes || null
                }
            })
        } else {
            // Crear nuevo cierre
            await prisma.dailyClose.create({
                data: {
                    closeDate,
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
                    invoicesData: data.invoicesData as unknown as Prisma.InputJsonObject,
                    expensesData: data.expensesData as unknown as Prisma.InputJsonObject,
                    closedBy: user.id,
                    closedByName: user.name,
                    notes: data.notes || null
                }
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
        const history = await prisma.dailyClose.findMany({
            orderBy: { closeDate: "desc" },
            take: 50
        })

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
        const dailyClose = await prisma.dailyClose.findUnique({
            where: { id }
        })

        if (!dailyClose) {
            return { success: false, error: "Cierre no encontrado" }
        }

        return { success: true, dailyClose }
    } catch (error) {
        console.error("Error al obtener cierre:", error)
        return { success: false, error: "Error al obtener cierre" }
    }
}