import { Suspense } from "react"
import { startOfMonth, endOfMonth, startOfDay, endOfDay, parseISO } from "date-fns"
import { DollarSign, Receipt, FileText } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AnalyticsFilters } from "@/components/modules/analytics/analytics-filters"
import { getAnalyticsSummary } from "@/lib/dashboard-stats"
import { formatCurrency } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string; to?: string }>
}) {
    const { from, to } = await searchParams
    const now = new Date()

    // Default period is the current month; a specific period comes from the filter via the URL.
    const rangeFrom = from ? startOfDay(parseISO(from)) : startOfMonth(now)
    const rangeTo = to ? endOfDay(parseISO(to)) : endOfMonth(now)

    const summary = await getAnalyticsSummary(rangeFrom, rangeTo)

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2 space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Analíticas</h2>
                <Suspense fallback={null}>
                    <AnalyticsFilters />
                </Suspense>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Facturas */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Facturas</CardTitle>
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.invoiceCount}</div>
                        <p className="text-xs text-muted-foreground">Facturas en el período</p>
                    </CardContent>
                </Card>

                {/* Monto facturado */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monto Facturado</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(summary.invoiceTotal)}</div>
                        <p className="text-xs text-muted-foreground">Total facturado en el período</p>
                    </CardContent>
                </Card>

                {/* Cotizaciones */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cotizaciones</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.quoteCount}</div>
                        <p className="text-xs text-muted-foreground">Cotizaciones en el período</p>
                    </CardContent>
                </Card>

                {/* Monto cotizado */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monto Cotizado</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(summary.quoteTotal)}</div>
                        <p className="text-xs text-muted-foreground">Total cotizado en el período</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
