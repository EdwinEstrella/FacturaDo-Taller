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

    // Calcular totales
    const totalIncome = pendingTransactions
        .filter(t => t.type === "INCOME")
        .reduce((sum, t) => sum + Number(t.amount), 0)

    const totalExpense = pendingTransactions
        .filter(t => t.type === "EXPENSE")
        .reduce((sum, t) => sum + Number(t.amount), 0)

    const currentBalance = openingBalance + totalIncome - totalExpense

    // Obtener historial de cierres
    const closings = await prisma.pettyCashClosing.findMany({
        orderBy: { closedAt: "desc" },
        take: 10
    })

    return {
        openingBalance,
        totalIncome,
        totalExpense,
        currentBalance,
        pendingTransactions,
        closings,
        isAdmin: user?.role === "ADMIN"
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

    const closingBalance = openingBalance + totalIncome - totalExpense

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