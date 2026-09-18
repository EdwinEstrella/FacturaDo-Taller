import { notFound } from "next/navigation"
import Script from "next/script"

import { getCashShiftById, getCurrentShiftSummary } from "@/actions/cash-shift-actions"
import { CashCloseReport, type CashCloseReportData } from "@/components/modules/daily-close/cash-close-report"

export const dynamic = 'force-dynamic'

export default async function PrintCashClosePage({
    params,
}: {
    params: Promise<{ shiftId: string }>
}) {
    const { shiftId } = await params
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
        // Open shift preview: compute live figures. The physical count is done at close.
        const summary = await getCurrentShiftSummary()
        const live = summary && summary.shift && summary.shift.id === shiftId ? summary : null

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
            expectedCash: live ? live.expectedCash : 0,
            actualCash: 0,
            discrepancy: 0,
            billBreakdownRD: {},
            billBreakdownUSD: {},
            billBreakdownEUR: {},
            totalRD: 0,
            totalUSD: 0,
            totalEUR: 0,
            invoices: live ? live.invoices : [],
            payments: live ? live.payments : [],
            expenses: live ? live.expenses : [],
            openingNotes: shift.openingNotes || null,
            closeNotes: null,
            arqueoRegistered: false,
        }
    }

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center py-6 print:bg-white print:py-0">
            <div className="bg-white shadow print:shadow-none">
                <CashCloseReport data={data} />
            </div>
            <Script id="print-cash-close" strategy="afterInteractive">
                {`window.print();`}
            </Script>
        </div>
    )
}
