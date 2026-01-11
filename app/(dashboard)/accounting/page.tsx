import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"

export default async function AccountingPage() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dailySales = await prisma.invoice.aggregate({
        _sum: { total: true },
        where: {
            createdAt: { gte: today },
            status: 'PAID'
        }
    })

    const dailyExpensesAgg = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
            date: { gte: today },
            type: 'EXPENSE'
        }
    })

    const transactions = await prisma.transaction.findMany({
        where: {
            date: { gte: today }
        },
        orderBy: {
            date: 'desc'
        },
        take: 50
    })

    const salesTotal = Number(dailySales._sum.total || 0)
    // Note: If expenses are stored as positive numbers, we subtract them efficiently.
    // If they are negative, we add. Usually expenses are positive values in a 'amount' field.
    const expensesTotal = Number(dailyExpensesAgg._sum.amount || 0)
    const netBalance = salesTotal - expensesTotal

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Contabilidad / Cierre Diario</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader><CardTitle>Ventas del Día</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{formatCurrency(salesTotal)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Gastos (Caja Chica / Otros)</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600">{formatCurrency(expensesTotal)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Balance Neto</CardTitle></CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-bold ${netBalance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                            {formatCurrency(netBalance)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-8 space-y-4">
                <h3 className="text-xl font-bold">Transacciones de Hoy</h3>
                <div className="rounded-md border bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                                        No hay movimientos registrados hoy.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(t.date, 'HH:mm')}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${t.type === 'INCOME' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {t.type === 'INCOME' ? 'Ingreso' : 'Gasto'}
                                            </span>
                                        </TableCell>
                                        <TableCell>{t.category}</TableCell>
                                        <TableCell>{t.description || '-'}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formatCurrency(Number(t.amount))}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
