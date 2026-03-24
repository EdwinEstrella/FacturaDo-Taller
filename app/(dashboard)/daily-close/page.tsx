import { createServerClient } from "@/lib/insforge/client"
import { DailyCloseContent } from "@/components/modules/daily-close/daily-close-content"

export const dynamic = 'force-dynamic'

export default async function DailyClosePage() {
    const insforge = createServerClient()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // 1. Fetch Invoices for Today
    const { data: invoices } = await insforge.database
        .from('Invoice')
        .select('*')
        .gte('createdAt', today.toISOString())
        .lt('createdAt', tomorrow.toISOString())
        .eq('status', 'PAID')

    // 2. Fetch Transactions (Expenses) for Today
    const { data: transactions } = await insforge.database
        .from('Transaction')
        .select('*')
        .gte('date', today.toISOString())
        .lt('date', tomorrow.toISOString())
        .eq('type', 'EXPENSE')

    // 3. Fetch Payments (Actual Cash Flow)
    const { data: payments } = await insforge.database
        .from('Payment')
        .select('*, invoice:Invoice(sequenceNumber)')
        .gte('date', today.toISOString())
        .lt('date', tomorrow.toISOString())

    // 4. Calculate Totals

    // A. Billed (Facturado - Volume generated today)
    const totalBilled = (invoices || []).reduce((acc, inv) => acc + Number(inv.total), 0)

    // B. Collected (Cobrado - Money received today)
    const totalCollected = (payments || []).reduce((acc, p) => acc + Number(p.amount), 0)

    const collectedByMethod = (payments || []).reduce((acc, p) => {
        const method = p.method || "CASH"
        acc[method] = (acc[method] || 0) + Number(p.amount)
        return acc
    }, {} as Record<string, number>)

    const cashCollected = collectedByMethod["CASH"] || 0
    const otherCollected = totalCollected - cashCollected

    const totalExpenses = (transactions || []).reduce((acc, t) => acc + Number(t.amount), 0)
    const netCashInDrawer = cashCollected - totalExpenses

    // Convert Decimals to numbers for the component
    const formattedInvoices = (invoices || []).map(inv => ({
        ...inv,
        total: Number(inv.total)
    }))

    const formattedTransactions = (transactions || []).map(t => ({
        ...t,
        amount: Number(t.amount)
    }))

    return (
        <DailyCloseContent
            today={today}
            invoices={formattedInvoices}
            transactions={formattedTransactions}
            totalBilled={totalBilled}
            totalCollected={totalCollected}
            cashCollected={cashCollected}
            otherCollected={otherCollected}
            totalExpenses={totalExpenses}
            netCashInDrawer={netCashInDrawer}
        />
    )
}
