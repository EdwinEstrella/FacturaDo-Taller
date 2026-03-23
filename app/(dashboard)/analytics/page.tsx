import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AnalyticsFilters } from "@/components/modules/analytics/analytics-filters"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export const dynamic = 'force-dynamic'

async function getAnalyticsData(startDate: Date, endDate: Date) {
    const supabase = await createClient()

    // Income (Payments)
    const { data: payments } = await supabase
        .from('Payment')
        .select('*')
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())

    const totalIncome = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)

    // Group payments by method
    const incomeByMethod = (payments || []).reduce((acc, p) => {
        const method = p.method || 'OTROS'
        acc[method] = (acc[method] || 0) + Number(p.amount)
        return acc
    }, {} as Record<string, number>)

    // Expenses (Transactions)
    const { data: expenses } = await supabase
        .from('Transaction')
        .select('*')
        .eq('type', 'EXPENSE')
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())

    const totalExpenses = (expenses || []).reduce((sum, t) => sum + Number(t.amount), 0)

    // Group expenses by category
    const expensesByCategory = (expenses || []).reduce((acc, t) => {
        const category = t.category || 'OTROS'
        acc[category] = (acc[category] || 0) + Number(t.amount)
        return acc
    }, {} as Record<string, number>)

    return {
        totalIncome,
        incomeByMethod,
        totalExpenses,
        expensesByCategory,
        netProfit: totalIncome - totalExpenses
    }
}

export default async function AnalyticsPage() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfToday = new Date(now.setHours(23, 59, 59, 999))

    const data = await getAnalyticsData(startOfMonth, endOfToday)

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Analíticas</h2>

            <AnalyticsFilters />
        </div>
    )
}
