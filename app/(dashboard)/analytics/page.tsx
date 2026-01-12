import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { AnalyticsFilters } from "@/components/modules/analytics/analytics-filters"

export const dynamic = 'force-dynamic'

async function getAnalyticsData(startDate: Date, endDate: Date) {
    // 1. Income (Payments)
    const payments = await prisma.payment.findMany({
        where: {
            date: {
                gte: startDate,
                lte: endDate
            }
        }
    })

    const totalIncome = payments.reduce((sum, p) => sum + Number(p.amount), 0)

    // Group payments by method
    const incomeByMethod = payments.reduce((acc, p) => {
        const method = p.method || 'OTROS'
        acc[method] = (acc[method] || 0) + Number(p.amount)
        return acc
    }, {} as Record<string, number>)

    // 2. Expenses (Transactions)
    const expenses = await prisma.transaction.findMany({
        where: {
            type: 'EXPENSE',
            date: {
                gte: startDate,
                lte: endDate
            }
        }
    })

    const totalExpenses = expenses.reduce((sum, t) => sum + Number(t.amount), 0)

    // Group expenses by category
    const expensesByCategory = expenses.reduce((acc, t) => {
        const cat = t.category || 'GENERAL'
        acc[cat] = (acc[cat] || 0) + Number(t.amount)
        return acc
    }, {} as Record<string, number>)


    // 3. Top Products (Sales Volume)
    // We need to fetch resolved invoice items where invoice is PAID
    const soldItems = await prisma.invoiceItem.findMany({
        where: {
            invoice: {
                status: 'PAID',
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            }
        },
        select: {
            productName: true,
            quantity: true,
            price: true,
            product: {
                select: {
                    cost: true
                }
            }
        }
    })

    const productStats = soldItems.reduce((acc, item) => {
        const name = item.productName
        if (!acc[name]) {
            acc[name] = {
                quantity: 0,
                revenue: 0,
                cost: 0
            }
        }
        acc[name].quantity += item.quantity
        const revenue = Number(item.price) * item.quantity
        acc[name].revenue += revenue
        // Approx cost
        const cost = Number(item.product?.cost || 0) * item.quantity
        acc[name].cost += cost

        return acc
    }, {} as Record<string, { quantity: number, revenue: number, cost: number }>)

    // Convert to array and sort by revenue
    const topProducts = Object.entries(productStats)
        .map(([name, stat]) => ({ name, ...stat, profit: stat.revenue - stat.cost }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10) // Top 10

    return {
        totalIncome,
        incomeByMethod,
        totalExpenses,
        expensesByCategory,
        topProducts,
        netProfit: totalIncome - totalExpenses
    }
}

export default async function AnalyticsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams;

    // Determine Date Range
    const now = new Date()
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1) // First day of current month
    let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) // Last day of current month

    if (params.from) {
        startDate = new Date(params.from as string)
        // Ensure start of day
        startDate.setHours(0, 0, 0, 0)
    }

    if (params.to) {
        endDate = new Date(params.to as string)
        // Ensure end of day
        endDate.setHours(23, 59, 59, 999)
    }

    const data = await getAnalyticsData(startDate, endDate)

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Analíticas Avanzadas</h2>
                    <div className="text-sm text-muted-foreground mt-1">
                        Reporte del <span className="font-medium text-foreground">{startDate.toLocaleDateString()}</span> al <span className="font-medium text-foreground">{endDate.toLocaleDateString()}</span>
                    </div>
                </div>
                <AnalyticsFilters />
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-green-600">Ingresos Totales (Cobrado)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">{formatCurrency(data.totalIncome)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Pagos recibidos en el periodo
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-600">Gastos Totales</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">-{formatCurrency(data.totalExpenses)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Compras y gastos operativos
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Beneficio Neto</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${data.netProfit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                            {formatCurrency(data.netProfit)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Ingresos - Gastos
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Breakdown Section */}
            <div className="grid gap-8 md:grid-cols-2 mt-4">

                {/* Income by Method */}
                <Card>
                    <CardHeader>
                        <CardTitle>Ingresos por Método</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Método</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(data.incomeByMethod).map(([method, amount]) => (
                                    <TableRow key={method}>
                                        <TableCell>{method}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(amount)}</TableCell>
                                    </TableRow>
                                ))}
                                {Object.keys(data.incomeByMethod).length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center text-muted-foreground">Sin datos</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Expenses by Category */}
                <Card>
                    <CardHeader>
                        <CardTitle>Desglose de Gastos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(data.expensesByCategory).map(([cat, amount]) => (
                                    <TableRow key={cat}>
                                        <TableCell>{cat}</TableCell>
                                        <TableCell className="text-right font-medium text-red-600">-{formatCurrency(amount)}</TableCell>
                                    </TableRow>
                                ))}
                                {Object.keys(data.expensesByCategory).length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center text-muted-foreground">Sin gastos registrados</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Top Products */}
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Top Productos (Por Ingresos)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-right">Unidades</TableHead>
                                <TableHead className="text-right">Ingresos</TableHead>
                                <TableHead className="text-right">Ganancia Est.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.topProducts.map((p) => (
                                <TableRow key={p.name}>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell className="text-right">{p.quantity}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(p.revenue)}</TableCell>
                                    <TableCell className="text-right text-green-600">{formatCurrency(p.profit)}</TableCell>
                                </TableRow>
                            ))}
                            {data.topProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">Sin ventas registradas</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
