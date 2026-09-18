"use server"

import { requireAuth, getCurrentUser } from "@/actions/auth-actions"
import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"

export interface InvoiceItemData {
    productName: string
    quantity: number
    price: number
}

export interface InvoiceData {
    id: string
    sequenceNumber: number
    total: number
    paymentMethod: string | null
    createdAt: string
    clientName: string | null
    status?: string
    // Amounts needed so the report reconciles items to the net total (discount was being hidden).
    discount?: number
    tax?: number
    shippingCost?: number
    // Line items ("what was sold/done to collect the money"). Loaded for the daily-close report.
    items?: InvoiceItemData[]
}

export interface PaymentData {
    id: string
    invoiceId: string
    amount: number
    method: string
    date: string
    reference?: string | null
    invoiceSequenceNumber?: number | null
    clientName?: string | null
}

export interface ExpenseData {
    id: string
    description: string | null
    amount: number
    date: string
    category?: string | null
}

export interface CashShiftRecord {
    id: string
    shiftNumber: number
    status: "OPEN" | "CLOSED"
    openingBalance: number
    openedAt: string
    openedBy: string
    openedByName: string | null
    openingNotes?: string | null
    closedAt?: string | null
    closedBy?: string | null
    closedByName?: string | null
    totalBilled: number
    totalCollected: number
    cashCollected: number
    otherCollected: number
    totalExpenses: number
    expectedCash: number
    actualCash: number
    discrepancy: number
    billBreakdownRD?: Record<number, number>
    billBreakdownUSD?: Record<number, number>
    billBreakdownEUR?: Record<number, number>
    totalRD?: number
    totalUSD?: number
    totalEUR?: number
    invoicesData?: InvoiceData[]
    expensesData?: ExpenseData[]
    paymentsData?: PaymentData[]
    notes?: string | null
    createdAt?: string
    updatedAt?: string
}

export interface CurrentShiftSummary {
    shift: CashShiftRecord | null
    lastClosedShift: CashShiftRecord | null
    invoices: InvoiceData[]
    payments: PaymentData[]
    expenses: ExpenseData[]
    totalBilled: number
    totalCollected: number
    cashCollected: number
    otherCollected: number
    totalExpenses: number
    expectedCash: number
    openingBalance: number
    currentUser: {
        id: string
        name: string
        role: string
    }
}

/**
 * Verifica el estado del turno activo para el bloqueo global del sistema (Bistro/POS).
 */
export async function getActiveShiftStatus() {
    const user = await getCurrentUser()
    if (!user) return { hasActiveShift: false, lastClosedShift: null, currentUser: null }

    const insforge = createServerClient()
    const { data: openShifts } = await insforge.database
        .from('CashShift')
        .select('id, shiftNumber, openedAt, openedByName')
        .eq('status', 'OPEN')
        .limit(1)

    const hasActiveShift = !!(openShifts && openShifts.length > 0)

    let lastClosedShift: CashShiftRecord | null = null
    if (!hasActiveShift) {
        const { data: closedShifts } = await insforge.database
            .from('CashShift')
            .select('*')
            .eq('status', 'CLOSED')
            .order('closedAt', { ascending: false })
            .limit(1)
        if (closedShifts && closedShifts.length > 0) {
            lastClosedShift = closedShifts[0] as CashShiftRecord
        }
    }

    return {
        hasActiveShift,
        lastClosedShift,
        currentUser: {
            id: user.id,
            name: user.name || user.username,
            username: user.username,
            role: user.role
        }
    }
}

type DatabaseClient = ReturnType<typeof createServerClient>

async function resolvePaymentsWithInvoiceInfo(
    insforge: DatabaseClient,
    rawPayments: Array<{ id: string; invoiceId: string; amount: number | string; method: string | null; date: string; reference?: string | null }>
): Promise<PaymentData[]> {
    const paymentInvoiceIds = Array.from(new Set((rawPayments || []).map(p => p.invoiceId).filter(Boolean)))
    let invoiceInfoMap = new Map<string, { seq: number; clientName: string | null }>()

    if (paymentInvoiceIds.length > 0) {
        const { data: invList } = await insforge.database
            .from('Invoice')
            .select('id, sequenceNumber, clientName')
            .in('id', paymentInvoiceIds)

        if (invList) {
            invoiceInfoMap = new Map(invList.map(i => [i.id, { seq: Number(i.sequenceNumber), clientName: i.clientName || null }]))
        }
    }

    return (rawPayments || []).map(p => {
        const inv = p.invoiceId ? invoiceInfoMap.get(p.invoiceId) : null
        return {
            id: p.id,
            invoiceId: p.invoiceId,
            amount: Number(p.amount),
            method: p.method || 'CASH',
            date: p.date,
            reference: p.reference || null,
            invoiceSequenceNumber: inv?.seq || null,
            clientName: inv?.clientName || null
        }
    })
}

/**
 * Obtiene el turno/ciclo actual abierto y calcula sus métricas en tiempo real.
 */
export async function getCurrentShiftSummary(): Promise<CurrentShiftSummary | null> {
    const user = await requireAuth()
    const insforge = createServerClient()

    // 1. Buscar turno abierto más reciente
    const { data: openShifts } = await insforge.database
        .from('CashShift')
        .select('*')
        .eq('status', 'OPEN')
        .order('openedAt', { ascending: false })
        .limit(1)

    const currentShift = (openShifts && openShifts.length > 0) ? (openShifts[0] as CashShiftRecord) : null

    // 2. Buscar último turno cerrado para referencia de apertura
    const { data: closedShifts } = await insforge.database
        .from('CashShift')
        .select('*')
        .eq('status', 'CLOSED')
        .order('closedAt', { ascending: false })
        .limit(1)

    const lastClosedShift = (closedShifts && closedShifts.length > 0) ? (closedShifts[0] as CashShiftRecord) : null

    if (!currentShift) {
        return {
            shift: null,
            lastClosedShift,
            invoices: [],
            payments: [],
            expenses: [],
            totalBilled: 0,
            totalCollected: 0,
            cashCollected: 0,
            otherCollected: 0,
            totalExpenses: 0,
            expectedCash: 0,
            openingBalance: 0,
            currentUser: {
                id: user.id,
                name: user.name || user.username,
                role: user.role
            }
        }
    }

    const openedAt = currentShift.openedAt
    const now = new Date().toISOString()

    // 3. Consultar datos en vivo del turno activo
    const [
        { data: rawInvoices },
        { data: rawPayments },
        { data: rawExpenses }
    ] = await Promise.all([
        insforge.database
            .from('Invoice')
            .select('id, sequenceNumber, total, paymentMethod, createdAt, clientName, status, discount, tax, shippingCost')
            .gte('createdAt', openedAt)
            .lte('createdAt', now)
            .order('createdAt', { ascending: false }),

        insforge.database
            .from('Payment')
            .select('id, invoiceId, amount, method, date, reference')
            .gte('date', openedAt)
            .lte('date', now)
            .order('date', { ascending: false }),

        insforge.database
            .from('Transaction')
            .select('id, description, amount, date, category')
            .gte('date', openedAt)
            .lte('date', now)
            .eq('type', 'EXPENSE')
            .order('date', { ascending: false })
    ])

    // Load line items for the shift's invoices so the close report can show what was sold to collect the money.
    const invoiceIds = Array.from(new Set((rawInvoices || []).map(inv => inv.id).filter(Boolean)))
    const itemsByInvoice: Record<string, InvoiceItemData[]> = {}

    if (invoiceIds.length > 0) {
        const { data: rawItems } = await insforge.database
            .from('InvoiceItem')
            .select('invoiceId, productName, quantity, price')
            .in('invoiceId', invoiceIds)

        for (const it of (rawItems || []) as Array<{ invoiceId: string; productName: string | null; quantity: number | string; price: number | string }>) {
            const list = itemsByInvoice[it.invoiceId] || (itemsByInvoice[it.invoiceId] = [])
            list.push({
                productName: it.productName || 'Ítem',
                quantity: Number(it.quantity) || 0,
                price: Number(it.price) || 0,
            })
        }
    }

    const formattedInvoices: InvoiceData[] = (rawInvoices || []).map(inv => ({
        id: inv.id,
        sequenceNumber: Number(inv.sequenceNumber),
        total: Number(inv.total),
        paymentMethod: inv.paymentMethod || 'CASH',
        createdAt: inv.createdAt,
        clientName: inv.clientName || null,
        status: inv.status,
        discount: Number(inv.discount) || 0,
        tax: Number(inv.tax) || 0,
        shippingCost: Number(inv.shippingCost) || 0,
        items: itemsByInvoice[inv.id] || []
    }))

    const formattedPayments = await resolvePaymentsWithInvoiceInfo(insforge, (rawPayments || []) as any)

    const formattedExpenses: ExpenseData[] = (rawExpenses || []).map(e => ({
        id: e.id,
        description: e.description || 'Gasto de caja',
        amount: Number(e.amount),
        date: e.date,
        category: e.category || 'EXPENSE'
    }))

    // 4. Cálculos en tiempo real
    const openingBalance = Number(currentShift.openingBalance) || 0
    const totalBilled = formattedInvoices.reduce((acc, inv) => acc + inv.total, 0)
    const totalCollected = formattedPayments.reduce((acc, p) => acc + p.amount, 0)

    const cashCollected = formattedPayments
        .filter(p => !p.method || p.method === 'CASH')
        .reduce((acc, p) => acc + p.amount, 0)

    const otherCollected = totalCollected - cashCollected
    const totalExpenses = formattedExpenses.reduce((acc, e) => acc + e.amount, 0)
    const expectedCash = openingBalance + cashCollected - totalExpenses

    return {
        shift: currentShift,
        lastClosedShift,
        invoices: formattedInvoices,
        payments: formattedPayments,
        expenses: formattedExpenses,
        totalBilled,
        totalCollected,
        cashCollected,
        otherCollected,
        totalExpenses,
        expectedCash,
        openingBalance,
        currentUser: {
            id: user.id,
            name: user.name || user.username,
            role: user.role
        }
    }
}

/**
 * Abre un nuevo turno/ciclo de caja.
 */
export async function openCashShift(data: { openingBalance: number; notes?: string }) {
    const user = await requireAuth()
    const insforge = createServerClient()

    try {
        // Verificar que no haya un turno ya abierto
        const { data: activeShifts } = await insforge.database
            .from('CashShift')
            .select('id, shiftNumber')
            .eq('status', 'OPEN')
            .limit(1)

        if (activeShifts && activeShifts.length > 0) {
            return {
                success: false,
                error: `Ya existe un turno abierto (Turno #${activeShifts[0].shiftNumber}). Debe cerrarlo antes de iniciar otro.`
            }
        }

        const openingBalance = Number(data.openingBalance) || 0

        const { data: newShift, error } = await insforge.database
            .from('CashShift')
            .insert([{
                status: 'OPEN',
                openingBalance,
                openedAt: new Date().toISOString(),
                openedBy: user.id,
                openedByName: user.name || user.username,
                openingNotes: data.notes?.trim() || null,
                totalBilled: 0,
                totalCollected: 0,
                cashCollected: 0,
                otherCollected: 0,
                totalExpenses: 0,
                expectedCash: openingBalance,
                actualCash: 0,
                discrepancy: 0
            }])
            .select()
            .single()

        if (error || !newShift) {
            console.error("Error al abrir turno:", error)
            return { success: false, error: "No se pudo abrir el turno" }
        }

        revalidatePath("/daily-close")
        revalidatePath("/cash-close-history")

        return { success: true, shift: newShift }
    } catch (err: unknown) {
        console.error("Excepción al abrir turno:", err)
        return { success: false, error: err instanceof Error ? err.message : "Error inesperado al abrir turno" }
    }
}

export interface CloseShiftPayload {
    shiftId: string
    billBreakdownRD: Record<number, number>
    billBreakdownUSD?: Record<number, number>
    billBreakdownEUR?: Record<number, number>
    totalRD: number
    totalUSD?: number
    totalEUR?: number
    notes?: string
}

/**
 * Cierra el turno/ciclo actual, realiza el arqueo y persiste el snapshot completo.
 */
export async function closeCashShift(payload: CloseShiftPayload) {
    const user = await requireAuth()
    const insforge = createServerClient()

    try {
        // 1. Obtener el turno actual
        const { data: shift, error: fetchErr } = await insforge.database
            .from('CashShift')
            .select('*')
            .eq('id', payload.shiftId)
            .single()

        if (fetchErr || !shift) {
            return { success: false, error: "Turno no encontrado" }
        }

        if (shift.status === 'CLOSED') {
            return { success: false, error: "Este turno ya se encuentra cerrado" }
        }

        const openedAt = shift.openedAt
        const closedAt = new Date().toISOString()

        // 2. Obtener movimientos finales dentro del rango exacto del turno
        const [
            { data: rawInvoices },
            { data: rawPayments },
            { data: rawExpenses }
        ] = await Promise.all([
            insforge.database
                .from('Invoice')
                .select('id, sequenceNumber, total, paymentMethod, createdAt, clientName, status, discount, tax, shippingCost')
                .gte('createdAt', openedAt)
                .lte('createdAt', closedAt),

            insforge.database
                .from('Payment')
                .select('id, invoiceId, amount, method, date, reference')
                .gte('date', openedAt)
                .lte('date', closedAt),

            insforge.database
                .from('Transaction')
                .select('id, description, amount, date, category')
                .gte('date', openedAt)
                .lte('date', closedAt)
                .eq('type', 'EXPENSE')
        ])

        // Load line items so the persisted snapshot (and history report) shows what was sold to collect.
        const closeInvoiceIds = Array.from(new Set((rawInvoices || []).map(inv => inv.id).filter(Boolean)))
        const closeItemsByInvoice: Record<string, InvoiceItemData[]> = {}

        if (closeInvoiceIds.length > 0) {
            const { data: rawItems } = await insforge.database
                .from('InvoiceItem')
                .select('invoiceId, productName, quantity, price')
                .in('invoiceId', closeInvoiceIds)

            for (const it of (rawItems || []) as Array<{ invoiceId: string; productName: string | null; quantity: number | string; price: number | string }>) {
                const list = closeItemsByInvoice[it.invoiceId] || (closeItemsByInvoice[it.invoiceId] = [])
                list.push({
                    productName: it.productName || 'Ítem',
                    quantity: Number(it.quantity) || 0,
                    price: Number(it.price) || 0,
                })
            }
        }

        const formattedInvoices: InvoiceData[] = (rawInvoices || []).map(inv => ({
            id: inv.id,
            sequenceNumber: Number(inv.sequenceNumber),
            total: Number(inv.total),
            paymentMethod: inv.paymentMethod || 'CASH',
            createdAt: inv.createdAt,
            clientName: inv.clientName || null,
            status: inv.status,
            discount: Number(inv.discount) || 0,
            tax: Number(inv.tax) || 0,
            shippingCost: Number(inv.shippingCost) || 0,
            items: closeItemsByInvoice[inv.id] || []
        }))

        const formattedPayments = await resolvePaymentsWithInvoiceInfo(insforge, (rawPayments || []) as any)

        const formattedExpenses: ExpenseData[] = (rawExpenses || []).map(e => ({
            id: e.id,
            description: e.description || 'Gasto de caja',
            amount: Number(e.amount),
            date: e.date,
            category: e.category || 'EXPENSE'
        }))

        const openingBalance = Number(shift.openingBalance) || 0
        const totalBilled = formattedInvoices.reduce((acc, inv) => acc + inv.total, 0)
        const totalCollected = formattedPayments.reduce((acc, p) => acc + p.amount, 0)

        const cashCollected = formattedPayments
            .filter(p => !p.method || p.method === 'CASH')
            .reduce((acc, p) => acc + p.amount, 0)

        const otherCollected = totalCollected - cashCollected
        const totalExpenses = formattedExpenses.reduce((acc, e) => acc + e.amount, 0)
        const expectedCash = openingBalance + cashCollected - totalExpenses
        const actualCash = Number(payload.totalRD) || 0
        const discrepancy = actualCash - expectedCash

        const updateData = {
            status: 'CLOSED',
            closedAt,
            closedBy: user.id,
            closedByName: user.name || user.username,
            totalBilled,
            totalCollected,
            cashCollected,
            otherCollected,
            totalExpenses,
            expectedCash,
            actualCash,
            discrepancy,
            billBreakdownRD: payload.billBreakdownRD || {},
            billBreakdownUSD: payload.billBreakdownUSD || {},
            billBreakdownEUR: payload.billBreakdownEUR || {},
            totalRD: actualCash,
            totalUSD: payload.totalUSD || 0,
            totalEUR: payload.totalEUR || 0,
            invoicesData: formattedInvoices,
            expensesData: formattedExpenses,
            paymentsData: formattedPayments,
            notes: payload.notes?.trim() || null,
            updatedAt: new Date().toISOString()
        }

        const { error: updateErr } = await insforge.database
            .from('CashShift')
            .update(updateData)
            .eq('id', payload.shiftId)

        if (updateErr) {
            console.error("Error al actualizar cierre de turno:", updateErr)
            return { success: false, error: "Error al guardar el cierre del turno" }
        }

        // También creamos o actualizamos en DailyClose por retrocompatibilidad con reportes externos si fuera necesario
        try {
            await insforge.database
                .from('DailyClose')
                .insert([{
                    closeDate: closedAt,
                    totalBilled,
                    totalCollected,
                    cashCollected,
                    otherCollected,
                    totalExpenses,
                    netCashInDrawer: actualCash,
                    billBreakdownRD: payload.billBreakdownRD || {},
                    billBreakdownUSD: payload.billBreakdownUSD || {},
                    billBreakdownEUR: payload.billBreakdownEUR || {},
                    totalRD: actualCash,
                    totalUSD: payload.totalUSD || 0,
                    totalEUR: payload.totalEUR || 0,
                    discrepancy,
                    invoicesData: formattedInvoices,
                    expensesData: formattedExpenses,
                    notes: payload.notes?.trim() || null,
                    closedBy: user.id,
                    closedByName: user.name || user.username
                }])
        } catch (e: unknown) {
            console.warn("Aviso: No se duplicó en DailyClose (opcional):", e)
        }

        revalidatePath("/daily-close")
        revalidatePath("/cash-close-history")

        return {
            success: true,
            closedShift: {
                ...shift,
                ...updateData
            }
        }
    } catch (err: unknown) {
        console.error("Excepción al cerrar turno:", err)
        return { success: false, error: err instanceof Error ? err.message : "Error inesperado al cerrar turno" }
    }
}

/**
 * Registra un gasto rápido asociado al ciclo actual.
 */
export async function addShiftExpense(formData: FormData) {
    await requireAuth()

    const amount = parseFloat(formData.get("amount") as string)
    const description = (formData.get("description") as string)?.trim()

    if (!amount || amount <= 0) {
        throw new Error("El monto del gasto debe ser mayor a 0")
    }

    if (!description) {
        throw new Error("Debe ingresar una descripción del gasto")
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

    revalidatePath("/daily-close")
    revalidatePath("/petty-cash")
}

/**
 * Obtiene el historial completo de turnos/ciclos.
 */
export async function getCashShiftsHistory(limit = 50) {
    await requireAuth()
    const insforge = createServerClient()

    try {
        const { data: shifts, error } = await insforge.database
            .from('CashShift')
            .select('*')
            .order('openedAt', { ascending: false })
            .limit(limit)

        if (error) throw error

        return { success: true, shifts: (shifts || []) as CashShiftRecord[] }
    } catch (error) {
        console.error("Error al obtener historial de turnos:", error)
        return { success: false, error: "Error al obtener historial de turnos", shifts: [] }
    }
}

/**
 * Obtiene un turno específico por ID.
 */
export async function getCashShiftById(id: string) {
    await requireAuth()
    const insforge = createServerClient()

    try {
        const { data: shift, error } = await insforge.database
            .from('CashShift')
            .select('*')
            .eq('id', id)
            .single()

        if (error || !shift) {
            return { success: false, error: "Turno no encontrado" }
        }

        return { success: true, shift: shift as CashShiftRecord }
    } catch (error) {
        console.error("Error al consultar turno:", error)
        return { success: false, error: "Error al consultar turno" }
    }
}
