import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Users, CreditCard, Activity, TrendingUp, TrendingDown } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import {
    getRevenueComparison,
    getClientComparison,
    getInvoiceComparison,
} from "@/lib/dashboard-stats"

export default async function DashboardPage() {
    // Obtener datos reales con comparativas
    const [invoiceCount, clientCount, productCount, revenueStats, clientStats, invoiceStats] =
        await Promise.all([
            prisma.invoice.count(),
            prisma.client.count(),
            prisma.product.count(),
            getRevenueComparison(),
            getClientComparison(),
            getInvoiceComparison(),
        ])

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
        </div>
    )
}
