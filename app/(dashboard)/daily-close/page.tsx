import { prisma } from "@/lib/prisma"
import { DailyCloseContent } from "@/components/modules/daily-close/daily-close-content"

export const dynamic = 'force-dynamic'

export default async function DailyClosePage() {
    // Permission check inside layout or here. Sidebar hides it, but safe to add check if needed.
    // For now, assuming middleware/layout handles basic auth.

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // 1. Fetch Invoices for Today
    const invoices = await prisma.invoice.findMany({
        where: {
            createdAt: {
                gte: today,
                lt: tomorrow
            },
            status: 'PAID' // Only count paid/completed sales
        },
        select: {
            id: true,
            total: true,
            paymentMethod: true,
            sequenceNumber: true,
            clientName: true,
            createdAt: true
        }
    })

    // 2. Fetch Transactions (Expenses) for Today
    const transactions = await prisma.transaction.findMany({
        where: {
            date: {
                gte: today,
                lt: tomorrow
            },
            type: 'EXPENSE'
        }
    })

    // 3. Fetch Payments (Actual Cash Flow)
    const payments = await prisma.payment.findMany({
        where: {
            date: {
                gte: today,
                lt: tomorrow
            }
        },
        include: {
            invoice: { select: { sequenceNumber: true } }
        }
    })

    // 4. Calculate Totals

    // A. Billed (Facturado - Volume generated today)
    const totalBilled = invoices.reduce((acc, inv) => acc + Number(inv.total), 0)

    // B. Collected (Cobrado - Money received today)
    const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount), 0)

    const collectedByMethod = payments.reduce((acc, p) => {
        const method = p.method || "CASH"
        acc[method] = (acc[method] || 0) + Number(p.amount)
        return acc
    }, {} as Record<string, number>)

    const cashCollected = collectedByMethod["CASH"] || 0
    const otherCollected = totalCollected - cashCollected

    const totalExpenses = transactions.reduce((acc, t) => acc + Number(t.amount), 0)
    const netCashInDrawer = cashCollected - totalExpenses

    return (
        <DailyCloseContent
            today={today}
            invoices={invoices}
            transactions={transactions}
            payments={payments}
            totalBilled={totalBilled}
            totalCollected={totalCollected}
            cashCollected={cashCollected}
            otherCollected={otherCollected}
            totalExpenses={totalExpenses}
            netCashInDrawer={netCashInDrawer}
        />
    )
}
