"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import { closePettyCash, addPettyCashIncome, addPettyCashExpense } from "@/actions/petty-cash-actions"
import { formatCurrency } from "@/lib/utils"
import { Plus, Minus, FileText, Printer, Search, UserCheck, Clock } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useRouter } from "next/navigation"
import { useShiftGuard } from "@/components/modules/cash-close/closed-shift-dialog"

interface Transaction {
    id: string
    type: string
    category: string
    amount: number | string
    description: string | null
    date: string
    closingId?: string | null
}

interface Closing {
    id: string
    openingBalance: number | string
    totalIncome: number | string
    totalExpense: number | string
    closingBalance: number | string
    openedBy?: string | null
    openedByName?: string | null
    openedAt?: string | null
    closedBy?: string | null
    closedByName: string | null
    closedAt: string
    notes: string | null
}

interface PettyCashSummaryProps {
    openingBalance: number | string
    totalIncome: number
    totalExpense: number
    currentBalance: number
    pendingTransactions: Transaction[]
    closings: Closing[]
    isAdmin: boolean
    isAccountant: boolean
    totalCashSalesToday: number
    expectedBalance: number
    discrepancy: number
    canViewDiscrepancy: boolean
    currentPeriodOpener?: {
        name: string
        date: string | null
    }
    currentUser?: {
        id: string
        name: string
        role: string
    }
}

export function PettyCashContent({ summary, initialQuery = "" }: { summary: PettyCashSummaryProps; initialQuery?: string }) {
    const router = useRouter()
    const [query, setQuery] = useState(initialQuery)
    const [isPending, startTransition] = useTransition()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const filteredTransactions = summary.pendingTransactions.filter(t =>
        query ? t.description?.toLowerCase().includes(query.toLowerCase()) : true
    )

    const totalIncomeFiltered = filteredTransactions.filter(t => t.type === "INCOME").reduce((sum, t) => sum + Number(t.amount), 0)
    const totalExpenseFiltered = filteredTransactions.filter(t => t.type === "EXPENSE").reduce((sum, t) => sum + Number(t.amount), 0)

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(() => {
            router.push(query ? `/petty-cash?q=${encodeURIComponent(query)}` : "/petty-cash")
        })
    }

    const openerName = summary.currentPeriodOpener?.name || "Administración"
    const openerDate = summary.currentPeriodOpener?.date ? new Date(summary.currentPeriodOpener.date) : null
    const currentUserName = summary.currentUser?.name || "Usuario actual"
    const { requireShift } = useShiftGuard()

    const handleIncome = async (formData: FormData) => {
        if (!requireShift()) return
        await addPettyCashIncome(formData)
    }

    const handleExpense = async (formData: FormData) => {
        if (!requireShift()) return
        await addPettyCashExpense(formData)
    }

    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex justify-between items-center no-print">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Caja Chica</h2>
                        {/* Indicador claro de quién abrió y quién opera */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                            <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-blue-600" />
                                Período abierto por: <strong className="text-gray-900">{openerName}</strong>
                                {openerDate && ` (${format(openerDate, "dd/MM/yyyy HH:mm", { locale: es })})`}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                                Operando actualmente: <strong className="text-gray-900">{currentUserName}</strong>
                            </span>
                        </div>
                    </div>
                    <Button
                        onClick={() => window.print()}
                        variant="outline"
                        className="no-print"
                    >
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                    </Button>
                </div>

                {/* Formularios de operaciones - NO SE IMPRIMEN */}
                <div className="flex flex-col gap-4 border p-4 rounded-lg bg-gray-50 no-print">
                    <h3 className="font-semibold text-lg">Registrar Movimiento</h3>

                    <form onSubmit={handleSearch} className="flex gap-4 w-full items-end">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="search">Buscar</Label>
                            <Input
                                id="search"
                                name="q"
                                placeholder="Buscar por descripción..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                        <Button type="submit" variant="outline" disabled={isPending}>
                            <Search className="mr-1.5 h-4 w-4" />
                            Filtrar
                        </Button>
                    </form>

                    <form action={handleIncome} className="flex gap-4 w-full items-end border-l-4 border-green-500 pl-4 bg-green-50/50 p-3 rounded">
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

                    <form action={handleExpense} className="flex gap-4 w-full items-end border-l-4 border-red-500 pl-4 bg-red-50/50 p-3 rounded">
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
                                <Button
                                    onClick={(e) => {
                                        if (!requireShift()) {
                                            e.preventDefault()
                                            e.stopPropagation()
                                        }
                                    }}
                                    variant="default"
                                    className="w-full md:w-auto"
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Cerrar Caja Chica
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Cierre de Caja Chica</DialogTitle>
                                    <DialogDescription>
                                        Confirmar el cierre de caja. El registro guardará quién abrió el período ({openerName}) y quién lo cierra ({currentUserName}).
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    {/* Responsables */}
                                    <div className="p-3 bg-gray-100 rounded-md text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Apertura previa por:</span>
                                            <strong className="text-gray-900">{openerName}</strong>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Cierre actual por:</span>
                                            <strong className="text-gray-900">{currentUserName}</strong>
                                        </div>
                                    </div>

                                    {/* Verificación con facturación */}
                                    <div className={`p-3 rounded-lg border ${summary.discrepancy !== undefined && summary.discrepancy !== 0 ? (summary.discrepancy < 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200') : 'bg-green-50 border-green-200'}`}>
                                        <div className="flex justify-between items-center text-sm">
                                            <div>
                                                <p className="font-semibold">Ventas efectivo hoy:</p>
                                                <p className="text-lg font-bold">{formatCurrency(summary.totalCashSalesToday)}</p>
                                            </div>
                                            <div>
                                                <p className="font-semibold">Saldo esperado:</p>
                                                <p className="text-lg font-bold">{formatCurrency(summary.expectedBalance)}</p>
                                            </div>
                                            <div>
                                                <p className="font-semibold">Discrepancia:</p>
                                                <p className={`text-lg font-bold ${summary.discrepancy < 0 ? 'text-red-600' : summary.discrepancy > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                                    {summary.discrepancy < 0 ? '-' : ''}{formatCurrency(Math.abs(summary.discrepancy || 0))}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t pt-3">
                                        <p className="text-xs text-gray-500 mb-2">Resumen de transacciones de caja:</p>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-500">Saldo Anterior:</p>
                                                <p className="font-semibold">{formatCurrency(Number(summary.openingBalance))}</p>
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
                        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                            <h3 className="font-semibold">Historial de Cierres de Caja Chica</h3>
                            <Badge variant="outline">{summary.closings.length} cierres</Badge>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha Cierre</TableHead>
                                    <TableHead>Abierto por</TableHead>
                                    <TableHead>Cerrado por</TableHead>
                                    <TableHead className="text-right">Apertura</TableHead>
                                    <TableHead className="text-right">Ingresos</TableHead>
                                    <TableHead className="text-right">Gastos</TableHead>
                                    <TableHead className="text-right">Cierre</TableHead>
                                    <TableHead>Notas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summary.closings.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell className="text-xs">
                                            {format(new Date(c.closedAt), "dd/MM/yyyy HH:mm", { locale: es })}
                                        </TableCell>
                                        <TableCell className="text-xs font-medium">
                                            {c.openedByName || "Administración"}
                                        </TableCell>
                                        <TableCell className="text-xs font-semibold text-gray-900">
                                            {c.closedByName || "Usuario"}
                                        </TableCell>
                                        <TableCell className="text-right text-xs font-mono">{formatCurrency(Number(c.openingBalance))}</TableCell>
                                        <TableCell className="text-right text-xs font-mono text-green-600">{formatCurrency(Number(c.totalIncome))}</TableCell>
                                        <TableCell className="text-right text-xs font-mono text-red-600">{formatCurrency(Number(c.totalExpense))}</TableCell>
                                        <TableCell className="text-right text-xs font-mono font-bold">{formatCurrency(Number(c.closingBalance))}</TableCell>
                                        <TableCell className="text-xs text-gray-500 max-w-xs truncate">{c.notes || "-"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {/* VERIFICACIÓN DE CUADRE - Alerta de discrepancia - SOLO ADMIN Y CONTADOR */}
                {summary.canViewDiscrepancy && (summary.discrepancy !== undefined && summary.discrepancy !== 0) && (
                    <div className={`rounded-lg border p-4 no-print ${summary.discrepancy < 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className={`font-bold text-lg ${summary.discrepancy < 0 ? 'text-red-700' : 'text-yellow-700'}`}>
                                    ⚠️ Discrepancia Detectada
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    {summary.discrepancy < 0
                                        ? `Faltan ${formatCurrency(Math.abs(summary.discrepancy))} en caja según facturación del día`
                                        : `Sobran ${formatCurrency(summary.discrepancy)} en caja según facturación del día`
                                    }
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Ventas efectivo hoy:</p>
                                <p className="font-semibold">{formatCurrency(summary.totalCashSalesToday)}</p>
                                <p className="text-sm text-gray-500 mt-2">Saldo esperado:</p>
                                <p className="font-semibold">{formatCurrency(summary.expectedBalance)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ÁREA DE IMPRESIÓN - Solo visible al imprimir */}
            <div id="printable-area-wrapper" className="no-print">
                <div id="printable-area">
                    {/* Encabezado de impresión */}
                    <div className="print-header">
                        <h1>Reporte de Caja Chica</h1>
                        <p>Período iniciado por: <strong>{openerName}</strong> | Cerrado por: <strong>{currentUserName}</strong></p>
                        {mounted && (
                            <>
                                <p>Fecha de emisión: {format(new Date(), "dd/MM/yyyy", { locale: es })} — Hora: {format(new Date(), "HH:mm", { locale: es })}</p>
                            </>
                        )}
                    </div>

                    {/* Resumen en estilo de impresión */}
                    <div className="print-summary-cards grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <p>Saldo Anterior</p>
                            <p>{formatCurrency(Number(summary.openingBalance))}</p>
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
                                                {format(new Date(t.date), "dd/MM/yyyy", { locale: es })}
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
                            <div className="print-signature-line">Entregado / Cerrado por: {currentUserName}</div>
                        </div>
                        <div className="print-signature">
                            <div className="print-signature-line">Recibido / Verificado por: (Administración)</div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
