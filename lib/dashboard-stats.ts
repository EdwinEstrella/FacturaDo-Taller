/**
 * Datos del Panel: indicadores del período, comparación con el período anterior,
 * evolución mensual y listados de seguimiento.
 */

import { createServerClient } from "./insforge/client"

export type DashboardPeriod = "today" | "week" | "month" | "year"

export const PERIOD_LABELS: Record<DashboardPeriod, { current: string; previous: string }> = {
    today: { current: "Hoy", previous: "ayer" },
    week: { current: "Esta semana", previous: "la semana pasada" },
    month: { current: "Este mes", previous: "el mes pasado" },
    year: { current: "Este año", previous: "el año pasado" },
}

export function parsePeriod(value: string | undefined): DashboardPeriod {
    return value === "today" || value === "week" || value === "year" ? value : "month"
}

/** Rango del período actual (hasta ahora) y el mismo tramo del período anterior. */
function getRanges(period: DashboardPeriod, now = new Date()) {
    let start: Date
    let prevStart: Date
    switch (period) {
        case "today":
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            prevStart = new Date(start)
            prevStart.setDate(start.getDate() - 1)
            break
        case "week": {
            // Semana de lunes a domingo
            const day = (now.getDay() + 6) % 7
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
            prevStart = new Date(start)
            prevStart.setDate(start.getDate() - 7)
            break
        }
        case "year":
            start = new Date(now.getFullYear(), 0, 1)
            prevStart = new Date(now.getFullYear() - 1, 0, 1)
            break
        default:
            start = new Date(now.getFullYear(), now.getMonth(), 1)
            prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    }
    // Se compara contra el mismo tramo transcurrido del período anterior (p. ej. 1–23 del mes pasado).
    const elapsed = now.getTime() - start.getTime()
    const prevEnd = new Date(Math.min(prevStart.getTime() + elapsed, start.getTime()))
    return { start, end: now, prevStart, prevEnd }
}

export interface Trend {
    value: number
    previous: number
    /** Cambio porcentual; null si no hay base de comparación. */
    change: number | null
}

function trend(value: number, previous: number): Trend {
    return { value, previous, change: previous > 0 ? ((value - previous) / previous) * 100 : null }
}

type Row = Record<string, unknown>
const num = (v: unknown) => Number(v ?? 0) || 0
const sum = (rows: Row[], key: string) => rows.reduce((acc, r) => acc + num(r[key]), 0)

export interface DashboardData {
    period: DashboardPeriod
    collected: Trend
    billed: Trend
    invoiceCount: Trend
    quoted: Trend
    quoteCount: number
    quoteAccepted: number
    newClients: Trend
    receivable: number
    receivableCount: number
    monthly: { name: string; facturado: number; cobrado: number }[]
    paymentMix: { method: string; amount: number }[]
    topProducts: { name: string; quantity: number; amount: number }[]
    topDebtors: { name: string; balance: number; invoices: number }[]
    recentInvoices: { id: string; sequenceNumber: number; clientName: string | null; total: number; status: string; createdAt: string }[]
}

export async function getDashboardData(period: DashboardPeriod): Promise<DashboardData> {
    const insforge = createServerClient()
    const { start, end, prevStart, prevEnd } = getRanges(period)
    const iso = (d: Date) => d.toISOString()

    const now = new Date()
    const chartStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const [
        invoices,
        prevInvoices,
        payments,
        prevPayments,
        quotes,
        prevQuotes,
        clients,
        prevClients,
        pending,
        chartInvoices,
        chartPayments,
        recent,
    ] = await Promise.all([
        insforge.database.from('Invoice').select('id, total, status').gte('createdAt', iso(start)).lte('createdAt', iso(end)),
        insforge.database.from('Invoice').select('total, status').gte('createdAt', iso(prevStart)).lt('createdAt', iso(prevEnd)),
        insforge.database.from('Payment').select('amount, method').gte('date', iso(start)).lte('date', iso(end)),
        insforge.database.from('Payment').select('amount').gte('date', iso(prevStart)).lt('date', iso(prevEnd)),
        insforge.database.from('Quote').select('total, status, isDraft').gte('createdAt', iso(start)).lte('createdAt', iso(end)),
        insforge.database.from('Quote').select('total, isDraft').gte('createdAt', iso(prevStart)).lt('createdAt', iso(prevEnd)),
        insforge.database.from('Client').select('id', { count: 'exact', head: true }).gte('createdAt', iso(start)).lte('createdAt', iso(end)),
        insforge.database.from('Client').select('id', { count: 'exact', head: true }).gte('createdAt', iso(prevStart)).lt('createdAt', iso(prevEnd)),
        insforge.database.from('Invoice').select('balance, clientName').eq('status', 'PENDING'),
        insforge.database.from('Invoice').select('total, status, createdAt').gte('createdAt', iso(chartStart)),
        insforge.database.from('Payment').select('amount, date').gte('date', iso(chartStart)),
        insforge.database.from('Invoice').select('id, sequenceNumber, clientName, total, status, createdAt').order('createdAt', { ascending: false }).limit(6),
    ])

    const rows = (r: { data: unknown }) => ((r.data || []) as Row[])
    const notCancelled = (list: Row[]) => list.filter((i) => i.status !== 'CANCELLED')

    const periodInvoices = notCancelled(rows(invoices))
    const periodQuotes = rows(quotes).filter((q) => !q.isDraft)

    // Productos más vendidos del período
    const invoiceIds = periodInvoices.map((i) => String(i.id))
    const productMap = new Map<string, { quantity: number; amount: number }>()
    if (invoiceIds.length > 0) {
        const { data: items } = await insforge.database
            .from('InvoiceItem')
            .select('productName, quantity, price')
            .in('invoiceId', invoiceIds)
        for (const it of (items || []) as Row[]) {
            const name = String(it.productName || 'Ítem')
            const entry = productMap.get(name) || { quantity: 0, amount: 0 }
            entry.quantity += num(it.quantity)
            entry.amount += num(it.quantity) * num(it.price)
            productMap.set(name, entry)
        }
    }

    // Formas de pago del período
    const mixMap = new Map<string, number>()
    for (const p of rows(payments)) {
        const method = String(p.method || 'CASH')
        mixMap.set(method, (mixMap.get(method) || 0) + num(p.amount))
    }

    // Clientes con más balance pendiente
    const debtorMap = new Map<string, { balance: number; invoices: number }>()
    for (const inv of rows(pending)) {
        const name = String(inv.clientName || 'Consumidor Final')
        const entry = debtorMap.get(name) || { balance: 0, invoices: 0 }
        entry.balance += num(inv.balance)
        entry.invoices += 1
        debtorMap.set(name, entry)
    }

    // Evolución de los últimos 6 meses
    const monthly = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
        const label = d.toLocaleString('es-ES', { month: 'short' }).replace('.', '')
        return { key: `${d.getFullYear()}-${d.getMonth()}`, name: label.charAt(0).toUpperCase() + label.slice(1), facturado: 0, cobrado: 0 }
    })
    const monthIndex = (date: unknown) => {
        const d = new Date(String(date))
        return monthly.findIndex((m) => m.key === `${d.getFullYear()}-${d.getMonth()}`)
    }
    for (const inv of notCancelled(rows(chartInvoices))) {
        const i = monthIndex(inv.createdAt)
        if (i >= 0) monthly[i].facturado += num(inv.total)
    }
    for (const p of rows(chartPayments)) {
        const i = monthIndex(p.date)
        if (i >= 0) monthly[i].cobrado += num(p.amount)
    }

    return {
        period,
        collected: trend(sum(rows(payments), 'amount'), sum(rows(prevPayments), 'amount')),
        billed: trend(sum(periodInvoices, 'total'), sum(notCancelled(rows(prevInvoices)), 'total')),
        invoiceCount: trend(periodInvoices.length, notCancelled(rows(prevInvoices)).length),
        quoted: trend(sum(periodQuotes, 'total'), sum(rows(prevQuotes).filter((q) => !q.isDraft), 'total')),
        quoteCount: periodQuotes.length,
        quoteAccepted: periodQuotes.filter((q) => q.status === 'ACCEPTED').length,
        newClients: trend(clients.count || 0, prevClients.count || 0),
        receivable: sum(rows(pending), 'balance'),
        receivableCount: rows(pending).length,
        monthly: monthly.map(({ name, facturado, cobrado }) => ({ name, facturado: Math.round(facturado), cobrado: Math.round(cobrado) })),
        paymentMix: [...mixMap].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
        topProducts: [...productMap].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount).slice(0, 5),
        topDebtors: [...debtorMap].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.balance - a.balance).slice(0, 5),
        recentInvoices: rows(recent).map((r) => ({
            id: String(r.id),
            sequenceNumber: num(r.sequenceNumber),
            clientName: (r.clientName as string) || null,
            total: num(r.total),
            status: String(r.status),
            createdAt: String(r.createdAt),
        })),
    }
}
