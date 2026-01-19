import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { getPettyCashSummary, closePettyCash, addPettyCashIncome, addPettyCashExpense } from "@/actions/petty-cash-actions"
import { formatCurrency } from "@/lib/utils"
import { Plus, Minus, FileText } from "lucide-react"
import { PrintButton } from "./print-button"
import "./petty-cash.css"

export default async function PettyCashPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const { q = "" } = await searchParams
    const summary = await getPettyCashSummary()

    const filteredTransactions = summary.pendingTransactions.filter(t =>
        q ? t.description?.toLowerCase().includes(q.toLowerCase()) : true
    )

    const totalIncomeFiltered = filteredTransactions.filter(t => t.type === "INCOME").reduce((sum, t) => sum + Number(t.amount), 0)
    const totalExpenseFiltered = filteredTransactions.filter(t => t.type === "EXPENSE").reduce((sum, t) => sum + Number(t.amount), 0)

    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex justify-between items-center no-print">
                    <h2 className="text-3xl font-bold tracking-tight">Caja Chica</h2>
                    <PrintButton />
                </div>

                {/* Formularios de operaciones - NO SE IMPRIMEN */}
                <div className="flex flex-col gap-4 border p-4 rounded-lg bg-gray-50 no-print">
                    <h3 className="font-semibold text-lg">Registrar Movimiento</h3>

                    <form className="flex gap-4 w-full items-end">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="search">Buscar</Label>
                            <Input
                                id="search"
                                name="q"
                                placeholder="Buscar por descripción..."
                                defaultValue={q}
                            />
                        </div>
                        <Button type="submit" variant="outline">Filtrar</Button>
                    </form>

                    <form action={addPettyCashIncome} className="flex gap-4 w-full items-end border-l-4 border-green-500 pl-4 bg-green-50/50 p-3 rounded">
                        <div className="flex-1 max-w-sm">
                            <Label htmlFor="income-desc">Descripción (Reposición)</Label>
                            <Input id="income-desc" name="description" placeholder="Reposición de caja..." required />
                        </div>
                        <div className="w-40">
                            <Label htmlFor="income-amount">Monto</Label>
                            <Input name="amount" type="number" step="0.01" placeholder="0.00" required />
                        </div>
                        <Button type="submit" variant="default" className="bg-green-600 hover:bg-green-700">
                            <Plus className="mr-2 h-4 w-4" />
                            Reposición
                        </Button>
                    </form>

                    <form action={addPettyCashExpense} className="flex gap-4 w-full items-end border-l-4 border-red-500 pl-4 bg-red-50/50 p-3 rounded">
                        <div className="flex-1 max-w-sm">
                            <Label htmlFor="expense-desc">Descripción (Gasto)</Label>
                            <Input id="expense-desc" name="description" placeholder="Compra de café..." required />
                        </div>
                        <div className="w-40">
                            <Label htmlFor="expense-amount">Monto</Label>
                            <Input name="amount" type="number" step="0.01" placeholder="0.00" required />
                        </div>
                        <Button type="submit" variant="destructive">
                            <Minus className="mr-2 h-4 w-4" />
                            Registrar Gasto
                        </Button>
                    </form>

                    {summary.isAdmin && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="default" className="w-full md:w-auto">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Cerrar Caja Chica
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Cierre de Caja Chica</DialogTitle>
                                    <DialogDescription>
                                        Confirmar el cierre de caja. Una vez cerrado, no se podrán modificar estos registros.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-500">Saldo Anterior:</p>
                                            <p className="font-semibold">{formatCurrency(summary.openingBalance)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Ingresos:</p>
                                            <p className="font-semibold text-green-600">{formatCurrency(summary.totalIncome)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Gastos:</p>
                                            <p className="font-semibold text-red-600">{formatCurrency(summary.totalExpense)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Saldo Final:</p>
                                            <p className="font-semibold text-xl">{formatCurrency(summary.currentBalance)}</p>
                                        </div>
                                    </div>
                                    <form id="close-form" action={closePettyCash}>
                                        <div className="grid gap-2">
                                            <Label htmlFor="notes">Notas del cierre (opcional)</Label>
                                            <Textarea
                                                id="notes"
                                                name="notes"
                                                placeholder="Observaciones del cierre..."
                                                rows={3}
                                            />
                                        </div>
                                    </form>
                                </div>
                                <DialogFooter>
                                    <DialogTrigger asChild>
                                        <Button variant="outline">Cancelar</Button>
                                    </DialogTrigger>
                                    <Button form="close-form" type="submit">Confirmar Cierre</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>

                {/* Historial de cierres - NO SE IMPRIME */}
                {summary.closings.length > 0 && (
                    <div className="rounded-md border no-print">
                        <div className="p-4 border-b bg-gray-50">
                            <h3 className="font-semibold">Historial de Cierres</h3>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Cerrado por</TableHead>
                                    <TableHead className="text-right">Apertura</TableHead>
                                    <TableHead className="text-right">Ingresos</TableHead>
                                    <TableHead className="text-right">Gastos</TableHead>
                                    <TableHead className="text-right">Cierre</TableHead>
                                    <TableHead>Notas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summary.closings.map((c: any) => (
                                    <TableRow key={c.id}>
                                        <TableCell>
                                            {new Date(c.closedAt).toLocaleDateString('es-DO')}
                                        </TableCell>
                                        <TableCell>{c.closedByName}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(Number(c.openingBalance))}</TableCell>
                                        <TableCell className="text-right text-green-600">{formatCurrency(Number(c.totalIncome))}</TableCell>
                                        <TableCell className="text-right text-red-600">{formatCurrency(Number(c.totalExpense))}</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(Number(c.closingBalance))}</TableCell>
                                        <TableCell className="text-sm text-gray-500 max-w-xs truncate">{c.notes || "-"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* ÁREA DE IMPRESIÓN - Solo visible al imprimir */}
            <div id="printable-area-wrapper" className="no-print">
                <div id="printable-area">
                    {/* Encabezado de impresión */}
                    <div className="print-header">
                        <h1>Reporte de Caja Chica</h1>
                        <p>Fecha: {new Date().toLocaleDateString("es-DO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                        <p>Hora: {new Date().toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>

                    {/* Resumen en estilo de impresión */}
                    <div className="print-summary-cards grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <p>Saldo Anterior</p>
                            <p>{formatCurrency(summary.openingBalance)}</p>
                        </div>
                        <div>
                            <p>Reposiciones del Periodo</p>
                            <p>{formatCurrency(summary.totalIncome)}</p>
                        </div>
                        <div>
                            <p>Gastos del Periodo</p>
                            <p>{formatCurrency(summary.totalExpense)}</p>
                        </div>
                        <div>
                            <p>Saldo Actual</p>
                            <p>{formatCurrency(summary.currentBalance)}</p>
                        </div>
                    </div>

                    {/* Tabla de movimientos */}
                    <div className="print-section">
                        <div className="print-section-header">Movimientos del Periodo</div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-right">Ingreso</TableHead>
                                    <TableHead className="text-right">Gasto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                                            No hay movimientos en este periodo
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredTransactions.map((t) => (
                                        <TableRow key={t.id}>
                                            <TableCell>
                                                {new Date(t.date).toLocaleDateString('es-DO')}
                                            </TableCell>
                                            <TableCell>{t.description}</TableCell>
                                            <TableCell className="text-right">
                                                {t.type === "INCOME" && formatCurrency(Number(t.amount))}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {t.type === "EXPENSE" && formatCurrency(Number(t.amount))}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                                {filteredTransactions.length > 0 && (
                                    <TableRow className="bg-gray-50 font-semibold">
                                        <TableCell colSpan={2}>TOTALES DEL PERIODO</TableCell>
                                        <TableCell className="text-right">
                                            {totalIncomeFiltered > 0 ? formatCurrency(totalIncomeFiltered) : ""}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {totalExpenseFiltered > 0 ? formatCurrency(totalExpenseFiltered) : ""}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pie de página con firmas */}
                    <div className="print-footer">
                        <div className="print-signature">
                            <div className="print-signature-line">Entregado por</div>
                        </div>
                        <div className="print-signature">
                            <div className="print-signature-line">Recibido por</div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}