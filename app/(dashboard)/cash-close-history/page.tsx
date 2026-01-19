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
import { HistoryFilters } from "@/components/modules/cash-close/history-filters"

// Define Props for SearchParams
interface Props {
    searchParams: Promise<{
        date?: string
        userId?: string
    }>
}

export default async function CashCloseHistoryPage({ searchParams }: Props) {
    // 0. Parse Params - Next.js 15: searchParams is a Promise
    const { date: dateParam, userId: userIdParam } = await searchParams

    const selectedDate = dateParam ? new Date(dateParam) : new Date()
    selectedDate.setHours(0, 0, 0, 0)

    const start = new Date(selectedDate)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    // 1. Fetch Users for Filter
    const users = await prisma.user.findMany({ select: { id: true, name: true } })

    // 2. Build Query Filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereInvoice: any = {
        createdAt: {
            gte: start,
            lt: end
        }
        // Removed status: 'PAID' to show all history
    }

    if (userIdParam && userIdParam !== "ALL") {
        whereInvoice.createdById = userIdParam
    }

    // 3. Fetch Data
    // A. Invoices (Created in period)
    const invoices = await prisma.invoice.findMany({
        where: whereInvoice,
        include: {
            createdBy: true
        },
        orderBy: { createdAt: 'desc' }
    })

    // B. Payments (Received in period)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wherePayment: any = {
        date: {
            gte: start,
            lt: end
        }
    }

    if (userIdParam && userIdParam !== "ALL") {
        wherePayment.invoice = {
            createdById: userIdParam
        }
    }

    const payments = await prisma.payment.findMany({
        where: wherePayment,
        include: {
            invoice: true
        },
        orderBy: { date: 'desc' }
    })

    // C. Expenses
    const transactions = await prisma.transaction.findMany({
        where: {
            date: {
                gte: start,
                lt: end
            },
            type: 'EXPENSE'
        },
        orderBy: { date: 'desc' }
    })

    // 4. Calculations
    // Total Volume (All generated invoices)
    const totalVolume = invoices.reduce((acc, inv) => acc + Number(inv.total), 0)

    // Pending (Operational metric: how much of TODAY's volume wasn't paid immediately? 
    // Or just Total Volume separate from Collected. Let's keep Volume as just Volume.)
    // Note: Pending is confusing if mixed. Let's just show Volume vs Collected.

    // Collected (From Payments)
    const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount), 0)

    // Cash Sales Logic (From Payments)
    const cashCollected = payments
        .filter(p => !p.method || p.method === 'CASH')
        .reduce((acc, p) => acc + Number(p.amount), 0)

    const totalExpenses = transactions.reduce((acc, t) => acc + Number(t.amount), 0)

    const netCash = cashCollected - totalExpenses

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Historial de Cierre</h2>
                <p className="text-muted-foreground">
                    Resumen de operaciones del día {selectedDate.toLocaleDateString()}.
                </p>
            </div>

            <HistoryFilters users={users} />

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Facturado (Volumen)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalVolume)}</div>
                        <p className="text-xs text-muted-foreground">Ventas generadas hoy</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresado (Total)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(totalCollected)}</div>
                        <p className="text-xs text-muted-foreground">Total cobrado hoy</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gastos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">-{formatCurrency(totalExpenses)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Efectivo en Caja</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">{formatCurrency(netCash)}</div>
                        <p className="text-xs text-muted-foreground">Ingresos Efectivo - Gastos</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-8 pt-4">
                {/* Payments List (Ingresos) - PRIMARY FOR CLOSE */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold">Detalle de Ingresos (Cobros)</h3>
                    <div className="border rounded-md bg-white">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Hora</TableHead>
                                    <TableHead>Factura #</TableHead>
                                    <TableHead>Método</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No hay cobros registrados</TableCell></TableRow>}
                                {payments.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>{p.date.toLocaleTimeString()}</TableCell>
                                        <TableCell className="font-mono">{String(p.invoice.sequenceNumber).padStart(6, '0')}</TableCell>
                                        <TableCell className="text-xs font-semibold">{p.method || 'CASH'}</TableCell>
                                        <TableCell className="text-right text-green-700 font-medium">+{formatCurrency(Number(p.amount))}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Expenses List */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold">Detalle de Gastos</h3>
                    <div className="border rounded-md bg-white">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Hora</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No hay gastos registrados</TableCell></TableRow>}
                                {transactions.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell>{t.date.toLocaleTimeString()}</TableCell>
                                        <TableCell>{t.description}</TableCell>
                                        <TableCell className="text-right text-red-600">-{formatCurrency(Number(t.amount))}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {/* Invoices List (Secondary Context) */}
            <div className="space-y-4 pt-4">
                <h3 className="text-lg font-bold text-muted-foreground">Facturas Generadas (Referencia)</h3>
                <div className="border rounded-md bg-gray-50 opacity-80">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Hora</TableHead>
                                <TableHead>#</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No se generaron facturas hoy</TableCell></TableRow>}
                            {invoices.map((inv) => (
                                <TableRow key={inv.id}>
                                    <TableCell>{inv.createdAt.toLocaleTimeString()}</TableCell>
                                    <TableCell>{inv.sequenceNumber}</TableCell>
                                    <TableCell>{inv.clientName || 'Cliente Desc.'}</TableCell>
                                    <TableCell>{inv.status}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(Number(inv.total))}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

        </div>
    )
}
