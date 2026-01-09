import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

    // Mock Expense
    const dailyExpenses = 500 // Demo

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Contabilidad / Cierre Diario</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader><CardTitle>Ventas del Día</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{formatCurrency(Number(dailySales._sum.total || 0))}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Gastos (Caja Chica)</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600">{formatCurrency(dailyExpenses)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Balance Neto</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">
                            {formatCurrency(Number(dailySales._sum.total || 0) - dailyExpenses)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">Registro de Transacciones</h3>
                <p className="text-muted-foreground">Listado de transacciones simulado...</p>
            </div>
        </div>
    )
}
