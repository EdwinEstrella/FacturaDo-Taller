"use server"


import { requireAuth } from "@/actions/auth-actions";
import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/actions/auth-actions"

export async function getPettyCashSummary() {
    await requireAuth();

    const user = await getCurrentUser()
    const insforge = createServerClient()

    // Get last closing
    const { data: lastClosing } = await insforge.database
        .from('PettyCashClosing')
        .select('*')
        .order('closedAt', { ascending: false })
        .limit(1)
        .single()

    const openingBalance = lastClosing?.closingBalance ?? 0

    // Get pending transactions
    const { data: pendingTransactions } = await insforge.database
        .from('Transaction')
        .select('*')
        .eq('category', 'PETTY_CASH')
        .is('closingId', null)
        .order('date', { ascending: false })

    // Calculate totals
    const totalIncome = (pendingTransactions || [])
        .filter(t => t.type === "INCOME")
        .reduce((sum, t) => sum + Number(t.amount), 0)

    const totalExpense = (pendingTransactions || [])
        .filter(t => t.type === "EXPENSE")
        .reduce((sum, t) => sum + Number(t.amount), 0)

    // Get today's cash invoices
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data: cashInvoicesToday } = await insforge.database
        .from('Invoice')
        .select('id, total, createdAt, sequenceNumber')
        .gte('createdAt', today.toISOString())
        .lt('createdAt', tomorrow.toISOString())
        .eq('paymentMethod', "CASH")
        .eq('status', "PAID")

    const totalCashSalesToday = (cashInvoicesToday || []).reduce((sum, inv) => sum + Number(inv.total), 0)

    const currentBalance = Number(openingBalance) + totalIncome - totalExpense
    const expectedBalance = Number(openingBalance) + totalCashSalesToday - totalExpense
    const discrepancy = currentBalance - expectedBalance

    // Get closing history
    const { data: closings } = await insforge.database
        .from('PettyCashClosing')
        .select('*')
        .order('closedAt', { ascending: false })
        .limit(10)

    const canViewDiscrepancy = user?.role === "ADMIN" || user?.role === "ACCOUNTANT"

    return {
        openingBalance,
        totalIncome,
        totalExpense,
        currentBalance,
        pendingTransactions: pendingTransactions || [],
        closings: closings || [],
        isAdmin: user?.role === "ADMIN",
        isAccountant: user?.role === "ACCOUNTANT",
        totalCashSalesToday: canViewDiscrepancy ? totalCashSalesToday : 0,
        expectedBalance: canViewDiscrepancy ? expectedBalance : currentBalance,
        discrepancy: canViewDiscrepancy ? discrepancy : 0,
        canViewDiscrepancy
    }
}

export async function closePettyCash(formData: FormData) {
    await requireAuth();

    const user = await getCurrentUser()

    if (!user || user.role !== "ADMIN") {
        throw new Error("Solo los administradores pueden cerrar caja chica")
    }

    const insforge = createServerClient()
    const notes = formData.get("notes") as string | null

    // Get last closing
    const { data: lastClosing } = await insforge.database
        .from('PettyCashClosing')
        .select('*')
        .order('closedAt', { ascending: false })
        .limit(1)
        .single()

    const openingBalance = lastClosing?.closingBalance ?? 0

    // Get pending transactions
    const { data: pendingTransactions } = await insforge.database
        .from('Transaction')
        .select('*')
        .eq('category', 'PETTY_CASH')
        .is('closingId', null)

    // Calculate totals
    const totalIncome = (pendingTransactions || [])
        .filter(t => t.type === "INCOME")
        .reduce((sum, t) => sum + Number(t.amount), 0)

    const totalExpense = (pendingTransactions || [])
        .filter(t => t.type === "EXPENSE")
        .reduce((sum, t) => sum + Number(t.amount), 0)

    const closingBalance = Number(openingBalance) + totalIncome - totalExpense

    // Create closing
    const { data: closing, error: closingError } = await insforge.database
        .from('PettyCashClosing')
        .insert([{
            openingBalance,
            totalIncome,
            totalExpense,
            closingBalance,
            notes,
            closedBy: user.id,
            closedByName: user.name
        }])
        .select()
        .single()

    if (closingError || !closing) {
        throw closingError
    }

    // Associate transactions with closing
    await insforge.database
        .from('Transaction')
        .update({ closingId: closing.id })
        .eq('category', 'PETTY_CASH')
        .is('closingId', null)

    revalidatePath("/petty-cash")
}

export async function addPettyCashIncome(formData: FormData) {
    await requireAuth();

    const amount = parseFloat(formData.get("amount") as string)
    const description = formData.get("description") as string

    if (!amount || amount <= 0) {
        throw new Error("Monto inválido")
    }

    const insforge = createServerClient()

    await insforge.database
        .from('Transaction')
        .insert([{
            type: "INCOME",
            category: "PETTY_CASH",
            amount,
            description,
            date: new Date().toISOString()
        }])

    revalidatePath("/petty-cash")
}

export async function addPettyCashExpense(formData: FormData) {
    await requireAuth();

    const amount = parseFloat(formData.get("amount") as string)
    const description = formData.get("description") as string

    if (!amount || amount <= 0) {
        throw new Error("Monto inválido")
    }

    const insforge = createServerClient()

    await insforge.database
        .from('Transaction')
        .insert([{
            type: "EXPENSE",
            category: "PETTY_CASH",
            amount,
            description,
            date: new Date().toISOString()
        }])

    revalidatePath("/petty-cash")
}
