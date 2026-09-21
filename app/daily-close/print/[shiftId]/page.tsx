import { notFound } from "next/navigation"
import Script from "next/script"

import { getCashShiftById, getCurrentShiftSummary } from "@/actions/cash-shift-actions"
import { CashCloseReport, type CashCloseReportData } from "@/components/modules/daily-close/cash-close-report"

export const dynamic = 'force-dynamic'

/** Parse a "denom:qty,denom:qty" string into a { [denom]: qty } map, keeping only positive counts. */
function parseCounts(value?: string): Record<string, number> {
    const out: Record<string, number> = {}
    if (!value) return out
    for (const part of value.split(',')) {
        const [d, q] = part.split(':')
        const denom = Number(d)
        const qty = Number(q)
        if (denom > 0 && qty > 0) out[String(denom)] = qty
    }
    return out
}

function sumCounts(map: Record<string, number>): number {
    return Object.entries(map).reduce((acc, [denom, qty]) => acc + Number(denom) * Number(qty), 0)
}

export default async function PrintCashClosePage({
    params,
    searchParams,
}: {
    params: Promise<{ shiftId: string }>
    searchParams: Promise<{ rd?: string; usd?: string; eur?: string; cn?: string }>
}) {
    const [{ shiftId }, sp] = await Promise.all([params, searchParams])
    const shiftResult = await getCashShiftById(shiftId)

    if (!shiftResult.success || !shiftResult.shift) return notFound()

    const shift = shiftResult.shift

    let data: CashCloseReportData

    if (shift.status === 'CLOSED') {
        // Closed shift: everything was snapshotted at close time.
        data = {
            shiftNumber: shift.shiftNumber,
            cashierName: shift.closedByName || shift.openedByName || "Usuario",
            openedAt: shift.openedAt,
            closedAt: shift.closedAt || null,
            status: shift.status,
            openingBalance: Number(shift.openingBalance) || 0,
            totalBilled: Number(shift.totalBilled) || 0,
            totalCollected: Number(shift.totalCollected) || 0,
            cashCollected: Number(shift.cashCollected) || 0,
            otherCollected: Number(shift.otherCollected) || 0,
            totalExpenses: Number(shift.totalExpenses) || 0,
            expectedCash: Number(shift.expectedCash) || 0,
            actualCash: Number(shift.actualCash) || 0,
            discrepancy: Number(shift.discrepancy) || 0,
            billBreakdownRD: (shift.billBreakdownRD || {}) as Record<string, number>,
            billBreakdownUSD: (shift.billBreakdownUSD || {}) as Record<string, number>,
            billBreakdownEUR: (shift.billBreakdownEUR || {}) as Record<string, number>,
            totalRD: Number(shift.totalRD) || 0,
            totalUSD: Number(shift.totalUSD) || 0,
            totalEUR: Number(shift.totalEUR) || 0,
            invoices: shift.invoicesData || [],
            payments: shift.paymentsData || [],
            expenses: shift.expensesData || [],
            openingNotes: shift.openingNotes || null,
            closeNotes: shift.notes || null,
            arqueoRegistered: true,
        }
    } else {
        // Open shift preview: compute live figures. The physical count comes from the screen (query params).
        const summary = await getCurrentShiftSummary()
        const live = summary && summary.shift && summary.shift.id === shiftId ? summary : null

        const breakdownRD = parseCounts(sp.rd)
        const breakdownUSD = parseCounts(sp.usd)
        const breakdownEUR = parseCounts(sp.eur)
        const totalRD = sumCounts(breakdownRD)
        const hasCounts =
            Object.keys(breakdownRD).length + Object.keys(breakdownUSD).length + Object.keys(breakdownEUR).length > 0
        const expectedCash = live ? live.expectedCash : 0

        data = {
            shiftNumber: shift.shiftNumber,
            cashierName: shift.openedByName || "Usuario",
            openedAt: shift.openedAt,
            closedAt: null,
            status: shift.status,
            openingBalance: live ? live.openingBalance : (Number(shift.openingBalance) || 0),
            totalBilled: live ? live.totalBilled : 0,
            totalCollected: live ? live.totalCollected : 0,
            cashCollected: live ? live.cashCollected : 0,
            otherCollected: live ? live.otherCollected : 0,
            totalExpenses: live ? live.totalExpenses : 0,
            expectedCash,
            actualCash: totalRD,
            discrepancy: hasCounts ? totalRD - expectedCash : 0,
            billBreakdownRD: breakdownRD,
            billBreakdownUSD: breakdownUSD,
            billBreakdownEUR: breakdownEUR,
            totalRD,
            totalUSD: sumCounts(breakdownUSD),
            totalEUR: sumCounts(breakdownEUR),
            invoices: live ? live.invoices : [],
            payments: live ? live.payments : [],
            expenses: live ? live.expenses : [],
            openingNotes: shift.openingNotes || null,
            closeNotes: sp.cn || null,
            arqueoRegistered: hasCounts,
        }
    }

    return (
        <div data-print-format="ticket" className="min-h-screen bg-gray-100 flex justify-center py-6 print:bg-white print:py-0">
            <div className="bg-white shadow print:shadow-none">
                <CashCloseReport data={data} />
            </div>
            <Script id="print-cash-close" strategy="afterInteractive">
                {`if (window.self === window.top) { window.print(); }`}
            </Script>
        </div>
    )
}
