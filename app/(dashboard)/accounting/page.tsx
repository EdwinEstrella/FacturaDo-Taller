import { createServerClient } from "@/lib/insforge/client"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"

export default async function AccountingPage() {
    const insforge = createServerClient()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get today's sales
    const { data: invoices } = await insforge.database
        .from('Invoice')
        .select('total')
        .gte('createdAt', today.toISOString())
        .lt('createdAt', tomorrow.toISOString())
        .eq('status', 'PAID')

    const salesTotal = (invoices || []).reduce((sum, inv) => sum + Number(inv.total), 0)

    // Get today's expenses
    const { data: expenses } = await insforge.database
        .from('Transaction')
        .select('*')
        .gte('date', today.toISOString())
        .lt('date', tomorrow.toISOString())
        .eq('type', 'EXPENSE')

    const expensesTotal = (expenses || []).reduce((sum, t) => sum + Number(t.amount), 0)
    const netBalance = salesTotal - expensesTotal

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Contabilidad / Cierre Diario</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader><CardTitle>Ventas del Día</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{formatCurrency(salesTotal)}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Gastos del Día</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-red-500">{formatCurrency(expensesTotal)}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Balance Neto</CardTitle></CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(netBalance)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Transacciones del Día</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Hora</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead>Monto</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(expenses || []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No hay transacciones</TableCell></TableRow>}
                            {(expenses || []).map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell>{format(new Date(t.date), 'HH:mm')}</TableCell>
                                    <TableCell>{t.type === 'INCOME' ? 'Ingreso' : 'Gasto'}</TableCell>
                                    <TableCell>{t.category}</TableCell>
                                    <TableCell className={t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}>
                                        {formatCurrency(Number(t.amount))}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
