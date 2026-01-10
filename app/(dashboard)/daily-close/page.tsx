import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
// import { getCurrentUser } from "@/actions/auth-actions"
// import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PrintButton } from "@/components/modules/daily-close/print-button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

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

    // 3. Calculate Totals
    const totalSales = invoices.reduce((acc, inv) => acc + Number(inv.total), 0)

    // Group by Method
    const salesByMethod = invoices.reduce((acc, inv) => {
        const method = inv.paymentMethod || "CASH" // Default to CASH
        acc[method] = (acc[method] || 0) + Number(inv.total)
        return acc
    }, {} as Record<string, number>)

    const cashSales = salesByMethod["CASH"] || 0
    const otherSales = totalSales - cashSales

    const totalExpenses = transactions.reduce((acc, t) => acc + Number(t.amount), 0)

    const netCashInDrawer = cashSales - totalExpenses

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between no-print">
                <h2 className="text-3xl font-bold tracking-tight">Cierre de Día ({today.toLocaleDateString()})</h2>
                <PrintButton />
            </div>

            {/* Print Header (Visible only on print) */}
            <div className="hidden print-block mb-8 text-center">
                <h1 className="text-2xl font-bold">REPORTE DE CIERRE DIARIO</h1>
                <p>Fecha: {today.toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 no-print-grid">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas Efectivo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(cashSales)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gastos (Caja)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">-{formatCurrency(totalExpenses)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Efectivo en Caja (Neto)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">{formatCurrency(netCashInDrawer)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Print Friendly Summary Table */}
            <div className="mt-8 border rounded-lg p-4 bg-white">
                <h3 className="text-lg font-bold mb-4 border-b pb-2">Resumen de Cuadre</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm max-w-md">
                    <div className="flex justify-between">
                        <span>(+) Ventas Efectivo:</span>
                        <span className="font-mono">{formatCurrency(cashSales)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                        <span>(+) Ventas Tarjeta/Otros:</span>
                        <span className="font-mono">{formatCurrency(otherSales)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-1">
                        <span>(=) Total Ventas:</span>
                        <span className="font-mono">{formatCurrency(totalSales)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 mt-2">
                        <span>(-) Gastos Caja Chica:</span>
                        <span className="font-mono">-{formatCurrency(totalExpenses)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t border-black pt-2 mt-2">
                        <span>(=) EFECTIVO FINAL:</span>
                        <span className="font-mono">{formatCurrency(netCashInDrawer)}</span>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mt-8">
                {/* Invoices List */}
                <div>
                    <h3 className="text-lg font-bold mb-4">Detalle de Ventas</h3>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Hora</TableHead>
                                    <TableHead>Factura #</TableHead>
                                    <TableHead>Metodo</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No hay ventas hoy</TableCell></TableRow>}
                                {invoices.map((inv) => (
                                    <TableRow key={inv.id}>
                                        <TableCell>{inv.createdAt.toLocaleTimeString()}</TableCell>
                                        <TableCell className="font-mono">{String(inv.sequenceNumber).padStart(6, '0')}</TableCell>
                                        <TableCell>{inv.paymentMethod || 'CASH'}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(Number(inv.total))}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Expenses List */}
                <div>
                    <h3 className="text-lg font-bold mb-4">Detalle de Gastos</h3>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Hora</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No hay gastos hoy</TableCell></TableRow>}
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

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    .print-block { display: block !important; }
                    body { background: white; }
                    .border { border: 1px solid #ddd; }
                }
                .print-block { display: none; }
            `}} />
        </div>
    )
}
