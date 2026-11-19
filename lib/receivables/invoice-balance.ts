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
        console.error(`Error loading payments for invoice ${invoiceId}:`, paymentsError)
    }

    // Load credit notes for this invoice (CreditNote.invoiceId is text)
    const { data: creditNotes, error: creditNotesError } = await insforge.database
        .from('CreditNote')
        .select('total')
        .eq('invoiceId', invoiceId)

    if (creditNotesError) {
        console.error(`Error loading credit notes for invoice ${invoiceId}:`, creditNotesError)
    }

    const totalPaid = roundCurrency(
        (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
    )
    const totalCredited = roundCurrency(
        (creditNotes || []).reduce((sum, c) => sum + Number(c.total || 0), 0)
    )

    const rawBalance = roundCurrency(Number(total) - totalPaid - totalCredited)
    const balance = rawBalance <= 0.01 ? 0 : rawBalance
    const status: "PAID" | "PENDING" = balance <= 0.01 ? "PAID" : "PENDING"

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
        const rawBalance = roundCurrency(total - paid - credited)
        const balance = rawBalance <= 0.01 ? 0 : rawBalance
        const status: "PAID" | "PENDING" = balance <= 0.01 ? "PAID" : "PENDING"

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
