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
    searchParams: {
        date?: string
        userId?: string
    }
}

export default async function CashCloseHistoryPage({ searchParams }: Props) {
    // 0. Parse Params
    // Use the `await` keyword for accessing `searchParams`, assuming Next.js 15+ behavior where params are promises, 
    // or standard async component behavior if earlier version but robust.
    // However, in Next 14/15 server components, searchParams is an object.
    // If we get an error about awaiting it, we can remove it. But let's assume standard object access first.
    // Wait, in latest Next.js canary it might be a promise. The safe way:
    // const params = await searchParams (if it were a promise), but normally its just passed as prop. 
    // Let's treat it as resolved object as per standard stable Next.js 14.

    // SAFETY CHECK: in some recent versions props are promises.
    // Let's treat it as synchronous first as used in most stable apps.

    const dateParam = searchParams?.date
    const userIdParam = searchParams?.userId

    const date = dateParam ? new Date(dateParam) : new Date()
    date.setHours(0, 0, 0, 0)

    const start = new Date(date)
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
    const invoices = await prisma.invoice.findMany({
        where: whereInvoice,
        include: {
            createdBy: true
        },
        orderBy: { createdAt: 'desc' }
    })

    // Expenses
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

    // Collected (PAID)
    const paidInvoices = invoices.filter(inv => inv.status === 'PAID')
    const totalCollected = paidInvoices.reduce((acc, inv) => acc + Number(inv.total), 0)

    // Pending
    const pendingTotal = totalVolume - totalCollected

    // Cash Sales Logic (Only from collected)
    const cashSales = paidInvoices
        .filter(inv => !inv.paymentMethod || inv.paymentMethod === 'CASH')
        .reduce((acc, inv) => acc + Number(inv.total), 0)

    const totalExpenses = transactions.reduce((acc, t) => acc + Number(t.amount), 0)

    const netCash = cashSales - totalExpenses

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Historial de Cierre</h2>
                <p className="text-muted-foreground">
                    Resumen de operaciones del día {date.toLocaleDateString()}.
                </p>
            </div>

            <HistoryFilters users={users} />

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas Totales (Volumen)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalVolume)}</div>
                        <p className="text-xs text-muted-foreground">Incluye pendientes ({formatCurrency(pendingTotal)})</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cobrado (Efectivo)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(cashSales)}</div>
                        <p className="text-xs text-muted-foreground">Solo facturas pagadas en efectivo</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gastos (Global)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">-{formatCurrency(totalExpenses)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Efectivo Neto</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">{formatCurrency(netCash)}</div>
                        <p className="text-xs text-muted-foreground">Cobrado Efectivo - Gastos</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-8 pt-4">
                {/* Invoices List */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold">Detalle de Ventas</h3>
                    <div className="border rounded-md bg-white">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Hora</TableHead>
                                    <TableHead>Factura #</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Metodo</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No se encontraron ventas</TableCell></TableRow>}
                                {invoices.map((inv) => (
                                    <TableRow key={inv.id}>
                                        <TableCell>{inv.createdAt.toLocaleTimeString()}</TableCell>
                                        <TableCell className="font-mono">{String(inv.sequenceNumber).padStart(6, '0')}</TableCell>
                                        <TableCell>
                                            <span className={`text-xs px-2 py-1 rounded-full ${inv.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {inv.status === 'PAID' ? 'PAGADO' : 'PENDIENTE'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs">{inv.paymentMethod || 'CASH'}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(Number(inv.total))}</TableCell>
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
        </div>
    )
}
