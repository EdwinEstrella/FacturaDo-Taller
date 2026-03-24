import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Users, CreditCard, Activity, TrendingUp, TrendingDown } from "lucide-react"
import { createServerClient } from "@/lib/insforge/client"
import { formatCurrency } from "@/lib/utils"
import {
    getRevenueComparison,
    getClientComparison,
    getInvoiceComparison,
    getFinancialHistory,
} from "@/lib/dashboard-stats"
import { Overview } from "@/components/dashboard/overview"

export default async function DashboardPage() {
    const insforge = createServerClient()

    // Obtener datos reales con comparativas
    const [
        { count: invoiceCount },
        { count: clientCount },
        { count: productCountVal },
        revenueStats,
        clientStats,
        invoiceStats,
        financialHistory
    ] = await Promise.all([
        insforge.database.from('Invoice').select('*', { count: 'exact', head: true }),
        insforge.database.from('Client').select('*', { count: 'exact', head: true }),
        insforge.database.from('Product').select('*', { count: 'exact', head: true }),
        getRevenueComparison(),
        getClientComparison(),
        getInvoiceComparison(),
        getFinancialHistory(),
    ])

    const productCount = productCountVal || 0

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Ingresos Totales */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(revenueStats.current)}</div>
                        <p className={`text-xs flex items-center gap-1 ${revenueStats.isPositive ? "text-green-600" : "text-red-600"}`}>
                            {revenueStats.isPositive ? (
                                <TrendingUp className="h-3 w-3" />
                            ) : (
                                <TrendingDown className="h-3 w-3" />
                            )}
                            {revenueStats.text}
                        </p>
                    </CardContent>
                </Card>

                {/* Clientes */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Clientes Nuevos</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{clientStats.current}</div>
                        <p className={`text-xs flex items-center gap-1 ${clientStats.isPositive ? "text-green-600" : "text-red-600"}`}>
                            {clientStats.isPositive ? (
                                <TrendingUp className="h-3 w-3" />
                            ) : (
                                <TrendingDown className="h-3 w-3" />
                            )}
                            {clientStats.text}
                        </p>
                    </CardContent>
                </Card>

                {/* Facturas */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Facturas</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{invoiceStats.current}</div>
                        <p className={`text-xs flex items-center gap-1 ${invoiceStats.isPositive ? "text-green-600" : "text-red-600"}`}>
                            {invoiceStats.isPositive ? (
                                <TrendingUp className="h-3 w-3" />
                            ) : (
                                <TrendingDown className="h-3 w-3" />
                            )}
                            {invoiceStats.text}
                        </p>
                    </CardContent>
                </Card>

                {/* Productos Activos */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Productos Activos</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{productCount}</div>
                        <p className="text-xs text-muted-foreground">Productos en stock</p>
                    </CardContent>
                </Card>
            </div>
            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Resumen</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                    <Overview data={financialHistory} />
                </CardContent>
            </Card>
        </div>
    )
}
