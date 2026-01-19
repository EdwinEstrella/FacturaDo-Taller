"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/actions/auth-actions"

export async function getPettyCashSummary() {
    const user = await getCurrentUser()

    // Obtener el último cierre para conocer el saldo de apertura
    const lastClosing = await prisma.pettyCashClosing.findFirst({
        orderBy: { closedAt: "desc" }
    })

    const openingBalance = lastClosing?.closingBalance ?? 0

    // Obtener transacciones pendientes (sin cerrar)
    const pendingTransactions = await prisma.transaction.findMany({
        where: {
            category: "PETTY_CASH",
            closingId: null
        },
        orderBy: { date: "desc" }
    })

    // Calcular totales de transacciones de caja chica
    const totalIncome = pendingTransactions
        .filter(t => t.type === "INCOME")
        .reduce((sum, t) => sum + Number(t.amount), 0)

    const totalExpense = pendingTransactions
        .filter(t => t.type === "EXPENSE")
        .reduce((sum, t) => sum + Number(t.amount), 0)

    // Obtener facturas de hoy pagadas en efectivo (para verificar cuadre)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const cashInvoicesToday = await prisma.invoice.findMany({
        where: {
            createdAt: {
                gte: today,
                lt: tomorrow
            },
            paymentMethod: "CASH",
            status: "PAID"
        },
        select: {
            id: true,
            total: true,
            createdAt: true,
            sequenceNumber: true
        }
    })

    // Total de ventas en efectivo de hoy
    const totalCashSalesToday = cashInvoicesToday.reduce((sum, inv) => sum + Number(inv.total), 0)

    // Saldo actual según transacciones de caja chica (apertura + reposiciones - gastos)
    const currentBalance = Number(openingBalance) + totalIncome - totalExpense

    // Saldo ESPERADO según facturación del día (apertura + ventas_cash - gastos_caja)
    // NOTA: Esto es lo que DEBERÍA haber en caja según las ventas del día
    const expectedBalance = Number(openingBalance) + totalCashSalesToday - totalExpense

    // Discrepancia (positivo = sobrante, negativo = faltante)
    // Si discrepancy > 0: Hay más dinero de lo esperado (sobrante)
    // Si discrepancy < 0: Falta dinero según facturación (faltante)
    const discrepancy = currentBalance - expectedBalance

    // Explicación:
    // - Si no hay reposiciones (totalIncome = 0), currentBalance = expectedBalance (sin discrepancia)
    // - Si hay reposiciones, el sistema detecta que el dinero en caja no coincide con las ventas

    // Obtener historial de cierres
    const closings = await prisma.pettyCashClosing.findMany({
        orderBy: { closedAt: "desc" },
        take: 10
    })

    // Solo admin y contador pueden ver discrepancias (para evitar que ventas sepa si hay faltante)
    const canViewDiscrepancy = user?.role === "ADMIN" || user?.role === "ACCOUNTANT"

    return {
        openingBalance,
        totalIncome,
        totalExpense,
        currentBalance,
        pendingTransactions,
        closings,
        isAdmin: user?.role === "ADMIN",
        isAccountant: user?.role === "ACCOUNTANT",
        // Nuevos campos para verificación (solo para admin y contador)
        totalCashSalesToday: canViewDiscrepancy ? totalCashSalesToday : 0,
        expectedBalance: canViewDiscrepancy ? expectedBalance : currentBalance,
        discrepancy: canViewDiscrepancy ? discrepancy : 0,
        canViewDiscrepancy
    }
}

export async function closePettyCash(formData: FormData) {
    const user = await getCurrentUser()

    if (!user || user.role !== "ADMIN") {
        throw new Error("Solo los administradores pueden cerrar caja chica")
    }

    const notes = formData.get("notes") as string | null

    // Obtener el último cierre
    const lastClosing = await prisma.pettyCashClosing.findFirst({
        orderBy: { closedAt: "desc" }
    })

    const openingBalance = lastClosing?.closingBalance ?? 0

    // Obtener transacciones pendientes
    const pendingTransactions = await prisma.transaction.findMany({
        where: {
            category: "PETTY_CASH",
            closingId: null
        }
    })

    // Calcular totales
    const totalIncome = pendingTransactions
        .filter(t => t.type === "INCOME")
        .reduce((sum, t) => sum + Number(t.amount), 0)

    const totalExpense = pendingTransactions
        .filter(t => t.type === "EXPENSE")
        .reduce((sum, t) => sum + Number(t.amount), 0)

    const closingBalance = Number(openingBalance) + totalIncome - totalExpense

    // Crear el cierre
    const closing = await prisma.pettyCashClosing.create({
        data: {
            openingBalance,
            totalIncome,
            totalExpense,
            closingBalance,
            notes,
            closedBy: user.id,
            closedByName: user.name
        }
    })

    // Asociar las transacciones al cierre
    await prisma.transaction.updateMany({
        where: {
            category: "PETTY_CASH",
            closingId: null
        },
        data: {
            closingId: closing.id
        }
    })

    revalidatePath("/petty-cash")
}

export async function addPettyCashIncome(formData: FormData) {
    const amount = parseFloat(formData.get("amount") as string)
    const description = formData.get("description") as string

    if (!amount || amount <= 0) {
        throw new Error("Monto inválido")
    }

    await prisma.transaction.create({
        data: {
            type: "INCOME",
            category: "PETTY_CASH",
            amount,
            description
        }
    })

    revalidatePath("/petty-cash")
}

export async function addPettyCashExpense(formData: FormData) {
    const amount = parseFloat(formData.get("amount") as string)
    const description = formData.get("description") as string

    if (!amount || amount <= 0) {
        throw new Error("Monto inválido")
    }

    await prisma.transaction.create({
        data: {
            type: "EXPENSE",
            category: "PETTY_CASH",
            amount,
            description
        }
    })

    revalidatePath("/petty-cash")
}