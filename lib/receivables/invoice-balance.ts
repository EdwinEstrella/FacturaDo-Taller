import { createServerClient } from "@/lib/insforge/client"

type ClientInstance = ReturnType<typeof createServerClient>

export interface InvoiceBalanceResult {
    total: number
    paid: number
    credited: number
    balance: number
    status: "PAID" | "PENDING"
}

export interface ComputeInvoiceBalanceOptions {
    newTotal?: number
    insforge?: ClientInstance
}

export function roundCurrency(val: number): number {
    return Math.round((Number(val) + Number.EPSILON) * 100) / 100
}

/**
 * Pure calculation deriving balance and status from total, paid, and credited amounts.
 * balance = max(round2(total - paid - credited), 0)
 * status = balance <= 0.01 ? "PAID" : "PENDING"
 */
export function deriveBalance(
    total: number,
    paid: number,
    credited: number
): { balance: number; status: "PAID" | "PENDING" } {
    const totalNum = roundCurrency(Number(total || 0))
    const paidNum = roundCurrency(Number(paid || 0))
    const creditedNum = roundCurrency(Number(credited || 0))
    const rawBalance = roundCurrency(totalNum - paidNum - creditedNum)
    const clamped = Math.max(rawBalance, 0)
    const balance = clamped <= 0.01 ? 0 : roundCurrency(clamped)
    const status: "PAID" | "PENDING" = balance <= 0.01 ? "PAID" : "PENDING"
    return { balance, status }
}

/**
 * Calculates new balance and status when invoice total is edited,
 * preserving legacy paid statuses and existing payment deltas
 * without requiring payment ledger rows.
 */
export function rebalanceAfterTotalChange(
    oldTotal: number,
    oldBalance: number,
    newTotal: number
): { balance: number; status: "PAID" | "PENDING" } {
    const safeOldTotal = Number(oldTotal || 0)
    const safeOldBalance = Number(oldBalance || 0)
    const safeNewTotal = Number(newTotal || 0)

    const delta = safeNewTotal - safeOldTotal
    const rawBalance = roundCurrency(safeOldBalance + delta)
    const clamped = Math.min(Math.max(rawBalance, 0), safeNewTotal)
    const balance = clamped <= 0.01 ? 0 : roundCurrency(clamped)
    const status: "PAID" | "PENDING" = balance <= 0.01 ? "PAID" : "PENDING"

    return { balance, status }
}

/**
 * Calculates the derived balance and status for an invoice
 * based on its total, all registered payments, and credit notes.
 *
 * balance = Math.max(total - paid - credited, 0)
 * status = balance <= 0.01 ? "PAID" : "PENDING"
 */
export async function computeInvoiceBalance(
    invoiceId: string,
    options?: ComputeInvoiceBalanceOptions
): Promise<InvoiceBalanceResult> {
    const insforge = options?.insforge ?? createServerClient()

    let total = options?.newTotal
    if (total === undefined) {
        const { data: invoice, error } = await insforge.database
            .from('Invoice')
            .select('total')
            .eq('id', invoiceId)
            .single()

        if (error || !invoice) {
            throw new Error(`Invoice ${invoiceId} not found`)
        }
        total = Number(invoice.total || 0)
    }

    // Load payments for this invoice (Payment.invoiceId is text)
    const { data: payments, error: paymentsError } = await insforge.database
        .from('Payment')
        .select('amount')
        .eq('invoiceId', invoiceId)

    if (paymentsError) {
        throw new Error(`Error loading payments for invoice ${invoiceId}: ${paymentsError.message}`)
    }

    // Load credit notes for this invoice (CreditNote.invoiceId is text)
    const { data: creditNotes, error: creditNotesError } = await insforge.database
        .from('CreditNote')
        .select('total')
        .eq('invoiceId', invoiceId)

    if (creditNotesError) {
        throw new Error(`Error loading credit notes for invoice ${invoiceId}: ${creditNotesError.message}`)
    }

    const totalPaid = roundCurrency(
        (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
    )
    const totalCredited = roundCurrency(
        (creditNotes || []).reduce((sum, c) => sum + Number(c.total || 0), 0)
    )

    const { balance, status } = deriveBalance(Number(total), totalPaid, totalCredited)

    return {
        total: roundCurrency(Number(total)),
        paid: totalPaid,
        credited: totalCredited,
        balance,
        status,
    }
}

/**
 * Batch derives balances and statuses for multiple invoices.
 * Fetches all related payments and credit notes in single grouped queries.
 */
export async function computeBatchInvoiceBalances(
    invoices: Array<{ id: string; total: number }>,
    options?: { insforge?: ClientInstance }
): Promise<Map<string, InvoiceBalanceResult>> {
    const resultMap = new Map<string, InvoiceBalanceResult>()
    if (invoices.length === 0) return resultMap

    const insforge = options?.insforge ?? createServerClient()
    const invoiceIds = invoices.map(i => i.id)

    const [paymentsRes, creditNotesRes] = await Promise.all([
        insforge.database
            .from('Payment')
            .select('invoiceId, amount')
            .in('invoiceId', invoiceIds),
        insforge.database
            .from('CreditNote')
            .select('invoiceId, total')
            .in('invoiceId', invoiceIds)
    ])

    if (paymentsRes.error) {
        throw new Error(`Error loading batch payments: ${paymentsRes.error.message}`)
    }
    if (creditNotesRes.error) {
        throw new Error(`Error loading batch credit notes: ${creditNotesRes.error.message}`)
    }

    const paymentsByInvoice = new Map<string, number>()
    for (const p of paymentsRes.data || []) {
        if (!p.invoiceId) continue
        const cur = paymentsByInvoice.get(p.invoiceId) || 0
        paymentsByInvoice.set(p.invoiceId, cur + Number(p.amount || 0))
    }

    const creditNotesByInvoice = new Map<string, number>()
    for (const c of creditNotesRes.data || []) {
        if (!c.invoiceId) continue
        const cur = creditNotesByInvoice.get(c.invoiceId) || 0
        creditNotesByInvoice.set(c.invoiceId, cur + Number(c.total || 0))
    }

    for (const inv of invoices) {
        const total = roundCurrency(Number(inv.total || 0))
        const paid = roundCurrency(paymentsByInvoice.get(inv.id) || 0)
        const credited = roundCurrency(creditNotesByInvoice.get(inv.id) || 0)
        const { balance, status } = deriveBalance(total, paid, credited)

        resultMap.set(inv.id, {
            total,
            paid,
            credited,
            balance,
            status,
        })
    }

    return resultMap
}
