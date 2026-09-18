"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CurrencyInput } from "@/components/ui/currency-input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Save,
    CheckCircle2,
    AlertCircle,
    Play,
    Minus,
    Receipt,
    Wallet,
    DollarSign,
    ArrowDownCircle,
    UserCheck,
    Clock,
    RotateCcw,
    Printer,
    ShoppingCart
} from "lucide-react"
import {
    openCashShift,
    closeCashShift,
    addShiftExpense,
    type CurrentShiftSummary
} from "@/actions/cash-shift-actions"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useRouter } from "next/navigation"
import "./daily-close-print.css"

const BILLS_RD = [1, 5, 10, 25, 50, 100, 200, 500, 1000, 2000]
const BILLS_USD = [1, 5, 10, 100]
const BILLS_EUR = [1, 5, 10, 20, 50, 100]

export function DailyCloseContent({ summary }: { summary: CurrentShiftSummary }) {
    const router = useRouter()
    const {
        shift,
        lastClosedShift,
        invoices,
        payments,
        expenses,
        totalBilled,
        totalCollected,
        cashCollected,
        otherCollected,
        totalExpenses,
        expectedCash,
        openingBalance,
        currentUser
    } = summary

    // Apertura de turno state
    const [openInitialCash, setOpenInitialCash] = useState<number>(
        lastClosedShift ? Number(lastClosedShift.actualCash || lastClosedShift.expectedCash || 0) : 0
    )
    const [openNotes, setOpenNotes] = useState("")
    const [isOpening, setIsOpening] = useState(false)
    const [openError, setOpenError] = useState("")

    // Cierre de turno state
    const [countsRD, setCountsRD] = useState<Record<number, number>>({})
    const [countsUSD, setCountsUSD] = useState<Record<number, number>>({})
    const [countsEUR, setCountsEUR] = useState<Record<number, number>>({})
    const [hasUSD, setHasUSD] = useState(false)
    const [hasEUR, setHasEUR] = useState(false)
    const [closeNotes, setCloseNotes] = useState("")
    const [isClosing, setIsClosing] = useState(false)
    const [closeSuccess, setCloseSuccess] = useState(false)
    const [closeError, setCloseError] = useState("")

    // Gasto rápido state
    const [expenseModalOpen, setExpenseModalOpen] = useState(false)
    const [quickExpenseAmount, setQuickExpenseAmount] = useState<number>(0)
    const [quickExpenseDesc, setQuickExpenseDesc] = useState("")
    const [isSavingExpense, setIsSavingExpense] = useState(false)

    const calculateTotal = (counts: Record<number, number>, denoms: number[]) => {
        return denoms.reduce((acc, denom) => acc + (denom * (counts[denom] || 0)), 0)
    }

    const totalRD = calculateTotal(countsRD, BILLS_RD)
    const totalUSD = calculateTotal(countsUSD, BILLS_USD)
    const totalEUR = calculateTotal(countsEUR, BILLS_EUR)

    const handleCountChange = (currency: 'RD' | 'USD' | 'EUR', denom: number, value: string) => {
        const count = parseInt(value) || 0
        if (currency === 'RD') setCountsRD(prev => ({ ...prev, [denom]: count }))
        if (currency === 'USD') setCountsUSD(prev => ({ ...prev, [denom]: count }))
        if (currency === 'EUR') setCountsEUR(prev => ({ ...prev, [denom]: count }))
    }

    // Acción: Abrir Turno
    const handleOpenShift = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsOpening(true)
        setOpenError("")

        if (isNaN(openInitialCash) || openInitialCash < 0) {
            setOpenError("El fondo inicial de caja no puede ser un número negativo")
            setIsOpening(false)
            return
        }

        const res = await openCashShift({
            openingBalance: openInitialCash,
            notes: openNotes
        })

        setIsOpening(false)
        if (res.success) {
            router.refresh()
        } else {
            setOpenError(res.error || "No se pudo abrir el turno")
        }
    }

    // Acción: Cerrar Turno
    const handleCloseShift = async () => {
        if (!shift) return
        setIsClosing(true)
        setCloseSuccess(false)
        setCloseError("")

        const result = await closeCashShift({
            shiftId: shift.id,
            billBreakdownRD: countsRD,
            billBreakdownUSD: hasUSD ? countsUSD : undefined,
            billBreakdownEUR: hasEUR ? countsEUR : undefined,
            totalRD,
            totalUSD: hasUSD ? totalUSD : 0,
            totalEUR: hasEUR ? totalEUR : 0,
            notes: closeNotes
        })

        setIsClosing(false)

        if (result.success) {
            setCloseSuccess(true)
            setTimeout(() => {
                window.print()
                router.refresh()
            }, 600)
        } else {
            setCloseError(result.error || "Error al cerrar el turno")
        }
    }

    // Acción: Registrar Gasto Rápido
    const handleQuickExpense = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!quickExpenseDesc.trim() || quickExpenseAmount <= 0) {
            alert("Debe ingresar descripción y un monto mayor a 0")
            return
        }

        setIsSavingExpense(true)
        try {
            const formData = new FormData()
            formData.append("description", quickExpenseDesc.trim())
            formData.append("amount", String(quickExpenseAmount))

            await addShiftExpense(formData)
            setExpenseModalOpen(false)
            setQuickExpenseDesc("")
            setQuickExpenseAmount(0)
            router.refresh()
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : "Error al registrar gasto")
        } finally {
            setIsSavingExpense(false)
        }
    }

    // -------------------------------------------------------------
    // RENDER 1: CUANDO NO HAY TURNO ABIERTO (PANTALLA DE APERTURA)
    // -------------------------------------------------------------
    if (!shift) {
        return (
            <div className="flex-1 space-y-6 p-8 pt-6 max-w-4xl mx-auto">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Control de Turnos de Caja</h2>
                    <p className="text-muted-foreground mt-1">
                        Iniciá un nuevo ciclo de trabajo para registrar ventas, cobros y gastos por turno.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Tarjeta de Apertura */}
                    <Card className="border-blue-200 shadow-sm">
                        <CardHeader className="bg-blue-50/50 pb-4 border-b">
                            <div className="flex items-center gap-2">
                                <Play className="h-5 w-5 text-blue-600 fill-blue-600" />
                                <CardTitle className="text-lg text-blue-950">Apertura de Turno</CardTitle>
                            </div>
                            <CardDescription>
                                Ingresá el efectivo con el que se inicia el turno en la caja física.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {openError && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700 text-sm">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{openError}</span>
                                </div>
                            )}

                            <form onSubmit={handleOpenShift} className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="open-cash" className="text-sm font-semibold text-gray-800">
                                        Fondo Inicial de Caja (Efectivo RD$) *
                                    </Label>
                                    <CurrencyInput
                                        id="open-cash"
                                        value={openInitialCash}
                                        onValueChange={(val) => setOpenInitialCash(val)}
                                        placeholder="0.00"
                                        autoFocus
                                        inputClassName="text-2xl font-bold py-3"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Dinero físico disponible para cambio al comenzar la jornada.
                                    </p>
                                </div>

                                <div>
                                    <Label htmlFor="open-notes" className="text-sm font-medium">
                                        Observaciones de Apertura (opcional)
                                    </Label>
                                    <Textarea
                                        id="open-notes"
                                        rows={2}
                                        value={openNotes}
                                        onChange={(e) => setOpenNotes(e.target.value)}
                                        placeholder="Ej: Turno mañana, billetes de 100 y 500 para cambio..."
                                        className="mt-1"
                                    />
                                </div>

                                <div className="p-3 bg-gray-50 rounded-md border text-xs text-gray-600 flex items-center gap-2">
                                    <UserCheck className="h-4 w-4 text-gray-500" />
                                    <span>
                                        Responsable de apertura: <strong>{currentUser.name}</strong> ({currentUser.role})
                                    </span>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isOpening}
                                    className="w-full bg-blue-600 hover:bg-blue-700 font-semibold py-5 text-base"
                                >
                                    {isOpening ? "Abriendo Turno..." : "Abrir Turno / Iniciar Ciclo"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Resumen del último turno cerrado */}
                    <div className="space-y-4">
                        {lastClosedShift ? (
                            <Card className="bg-neutral-50/70 border-neutral-200">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base text-neutral-800">Último Turno Cerrado</CardTitle>
                                        <Badge variant="outline">Turno #{lastClosedShift.shiftNumber}</Badge>
                                    </div>
                                    <CardDescription>
                                        Cerrado el {lastClosedShift.closedAt ? format(new Date(lastClosedShift.closedAt), "dd/MM/yyyy HH:mm", { locale: es }) : "N/A"}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="flex justify-between py-1 border-b">
                                        <span className="text-muted-foreground">Cajero:</span>
                                        <span className="font-medium">{lastClosedShift.closedByName || lastClosedShift.openedByName || "Usuario"}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b">
                                        <span className="text-muted-foreground">Fondo Apertura:</span>
                                        <span className="font-mono">{formatCurrency(Number(lastClosedShift.openingBalance))}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b">
                                        <span className="text-muted-foreground">Total Cobrado:</span>
                                        <span className="font-mono text-green-700">{formatCurrency(Number(lastClosedShift.totalCollected))}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b">
                                        <span className="text-muted-foreground">Gastos de Caja:</span>
                                        <span className="font-mono text-red-600">-{formatCurrency(Number(lastClosedShift.totalExpenses))}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b font-bold">
                                        <span>Saldo Final Arqueado:</span>
                                        <span className="font-mono text-blue-700 text-base">{formatCurrency(Number(lastClosedShift.actualCash))}</span>
                                    </div>
                                    {lastClosedShift.discrepancy !== 0 && (
                                        <div className="flex justify-between py-1 text-xs">
                                            <span className="text-muted-foreground">Diferencia de Cuadre:</span>
                                            <span className={`font-mono font-bold ${Number(lastClosedShift.discrepancy) < 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                                                {Number(lastClosedShift.discrepancy) < 0 ? 'Faltante: ' : 'Sobrante: '}
                                                {formatCurrency(Math.abs(Number(lastClosedShift.discrepancy)))}
                                            </span>
                                        </div>
                                    )}
                                    {lastClosedShift.notes && (
                                        <p className="text-xs text-gray-500 italic mt-2">
                                            &ldquo;{lastClosedShift.notes}&rdquo;
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="bg-neutral-50/70 border-dashed">
                                <CardContent className="p-8 text-center text-muted-foreground">
                                    <Receipt className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                                    <p className="font-medium">No hay registros de turnos previos.</p>
                                    <p className="text-xs mt-1">Este será el Turno #1 del sistema.</p>
                                </CardContent>
                            </Card>
                        )}

                        <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-900 space-y-1">
                            <p className="font-bold flex items-center gap-1.5">
                                <RotateCcw className="h-3.5 w-3.5" />
                                ¿Cómo funciona el ciclo de turnos?
                            </p>
                            <p>
                                Al abrir el turno, todas las ventas, cobros y salidas de caja se asignarán a esta sesión activa hasta que decidas realizar el arqueo y cierre.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // -------------------------------------------------------------
    // RENDER 2: CUANDO HAY UN TURNO EN CURSO (TURNO ACTIVO + CIERRE)
    // -------------------------------------------------------------
    const openedDate = new Date(shift.openedAt)
    const discrepancy = totalRD - expectedCash

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            {/* Header en pantalla */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print pb-2 border-b">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold tracking-tight">Turno #{shift.shiftNumber}</h2>
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1.5 px-3 py-1 font-semibold animate-pulse">
                            <span className="size-2 rounded-full bg-white inline-block"></span>
                            TURNO EN CURSO
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-gray-500" />
                            Iniciado el {format(openedDate, "dd/MM/yyyy HH:mm", { locale: es })}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <UserCheck className="h-4 w-4 text-gray-500" />
                            Apertura por: <strong>{shift.openedByName || "Usuario"}</strong>
                        </span>
                        {shift.openingNotes && (
                            <>
                                <span>•</span>
                                <span className="italic text-gray-500">&ldquo;{shift.openingNotes}&rdquo;</span>
                            </>
                        )}
                    </p>
                </div>

                {/* Acciones Rápidas */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => window.print()}
                        className="border-gray-300 text-gray-700 hover:bg-gray-100 font-medium"
                        title="Imprimir Reporte del Cuadre"
                    >
                        <Printer className="mr-1.5 h-4 w-4 text-gray-600" />
                        Imprimir Reporte
                    </Button>

                    <Dialog open={expenseModalOpen} onOpenChange={setExpenseModalOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
                                <Minus className="mr-1.5 h-4 w-4 text-red-600" />
                                Registrar Gasto Rápido
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="text-red-700 flex items-center gap-2">
                                    <ArrowDownCircle className="h-5 w-5 text-red-600" />
                                    Registrar Salida / Gasto de Caja
                                </DialogTitle>
                                <DialogDescription>
                                    Este egreso se registrará automáticamente en la sesión del Turno #{shift.shiftNumber}.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleQuickExpense} className="space-y-4 py-2">
                                <div>
                                    <Label htmlFor="quick-desc" className="text-sm font-semibold">Descripción o Motivo del Gasto *</Label>
                                    <Input
                                        id="quick-desc"
                                        value={quickExpenseDesc}
                                        onChange={(e) => setQuickExpenseDesc(e.target.value)}
                                        placeholder="Ej: Pago de delivery, compra de insumos, café..."
                                        required
                                        autoFocus
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="quick-amount" className="text-sm font-semibold">Monto en RD$ *</Label>
                                    <CurrencyInput
                                        id="quick-amount"
                                        value={quickExpenseAmount}
                                        onValueChange={(val) => setQuickExpenseAmount(val)}
                                        placeholder="0.00"
                                        className="mt-1 focus-within:ring-red-500 focus-within:border-red-500"
                                    />
                                </div>
                                <DialogFooter className="pt-2">
                                    <Button type="button" variant="outline" onClick={() => setExpenseModalOpen(false)}>
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={isSavingExpense} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                                        {isSavingExpense ? "Guardando..." : "Confirmar Gasto"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Print Header - Solo visible al imprimir */}
            <div className="print-only-header">
                <h1>REPORTE DE CUADRE Y CIERRE DE CAJA — TURNO #{shift.shiftNumber}</h1>
                <p>Apertura: {format(openedDate, "dd/MM/yyyy HH:mm", { locale: es })} — Emisión/Cierre: {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                <p>Cajero / Responsable: {shift.openedByName || currentUser.name || "Usuario"} | Estado: {shift.status === 'CLOSED' ? 'CERRADO' : 'EN CURSO'}</p>
            </div>

            {/* Cuadros de resumen estilo Ticket de Impresión - Solo imprimir */}
            <div className="print-summary-cards grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                    <p>Fondo Inicial</p>
                    <p>{formatCurrency(openingBalance)}</p>
                </div>
                <div>
                    <p>Facturación</p>
                    <p>{formatCurrency(totalBilled)}</p>
                </div>
                <div>
                    <p>Ingresos Cobrados</p>
                    <p>{formatCurrency(totalCollected)}</p>
                </div>
                <div>
                    <p>Gastos</p>
                    <p>-{formatCurrency(totalExpenses)}</p>
                </div>
                <div>
                    <p>Efectivo Físico</p>
                    <p>{formatCurrency(totalRD)}</p>
                </div>
            </div>

            {/* KPI Cards en Vivo - No imprimir */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 no-print">
                <Card className="bg-neutral-50/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-xs font-semibold uppercase text-gray-500">1. Fondo Inicial</CardTitle>
                        <Wallet className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="text-xl font-bold">{formatCurrency(openingBalance)}</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Monto de apertura</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-xs font-semibold uppercase text-gray-500">2. Facturado</CardTitle>
                        <Receipt className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="text-xl font-bold">{formatCurrency(totalBilled)}</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{invoices.length} facturas generadas</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-xs font-semibold uppercase text-green-700">3. Cobros Recibidos</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="text-xl font-bold text-green-700">{formatCurrency(totalCollected)}</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Efec: {formatCurrency(cashCollected)} / Banco: {formatCurrency(otherCollected)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-xs font-semibold uppercase text-red-600">4. Gastos de Turno</CardTitle>
                        <Minus className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="text-xl font-bold text-red-600">-{formatCurrency(totalExpenses)}</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{expenses.length} egresos en turno</p>
                    </CardContent>
                </Card>

                <Card className="bg-blue-50/80 border-blue-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-xs font-semibold uppercase text-blue-900">Efectivo Esperado</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-700" />
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="text-xl font-bold text-blue-700">{formatCurrency(expectedCash)}</div>
                        <p className="text-[11px] text-blue-600 mt-0.5">Fondo + Efec. Cobrado - Gastos</p>
                    </CardContent>
                </Card>
            </div>

            {/* SECCIÓN DE ARQUEO / DESGLOSE DE BILLETES */}
            <div className="bg-white border rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b pb-3">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Arqueo Físico de Caja</h3>
                        <p className="text-xs text-gray-500">
                            Contá los billetes en caja para validar el cuadre contra el efectivo esperado en el sistema.
                        </p>
                    </div>
                </div>

                <div className={`grid ${hasUSD && hasEUR ? 'md:grid-cols-3' : hasUSD || hasEUR ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-8 print-breakdown`}>
                    {/* Billetes RD$ */}
                    <div className="print-breakdown-section">
                        <h4 className="text-sm font-bold uppercase text-gray-600 mb-2">Desglose Billetes RD$ (Moneda Local)</h4>
                        <div className="border rounded-lg p-3 bg-gray-50/50">
                            {BILLS_RD.map(denom => (
                                <div key={denom} className={`print-bill-row flex items-center gap-2 mb-1.5 ${!countsRD[denom] ? 'hide-zero' : ''}`}>
                                    <span className="w-14 text-right font-mono font-semibold text-sm">RD$ {denom}</span>
                                    <span className="text-gray-400">×</span>
                                    <Input
                                        className="h-8 w-24 text-right font-mono font-bold bg-white"
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={countsRD[denom] || ''}
                                        onChange={(e) => handleCountChange('RD', denom, e.target.value)}
                                    />
                                    <span className="text-gray-400">=</span>
                                    <span className="flex-1 text-right font-mono font-medium text-sm">
                                        {formatCurrency(denom * (countsRD[denom] || 0))}
                                    </span>
                                </div>
                            ))}
                            <div className="border-t mt-3 pt-2 flex justify-between font-bold text-base text-gray-900">
                                <span>Total Físico RD$:</span>
                                <span className="font-mono">{formatCurrency(totalRD)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Divisas US$ */}
                    <div className={`print-breakdown-section ${!hasUSD ? 'no-print-usd' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold uppercase text-gray-600">Desglose Divisas US$</h4>
                            <div className="flex items-center space-x-2 no-print">
                                <Checkbox id="usd" checked={hasUSD} onCheckedChange={(c: boolean) => setHasUSD(c)} />
                                <Label htmlFor="usd" className="text-xs">Maneja USD</Label>
                            </div>
                        </div>
                        {hasUSD && (
                            <div className="border rounded-lg p-3 bg-gray-50/50">
                                {BILLS_USD.map(denom => (
                                    <div key={denom} className={`print-bill-row flex items-center gap-2 mb-1.5 ${!countsUSD[denom] ? 'hide-zero' : ''}`}>
                                        <span className="w-12 text-right font-mono text-sm">US$ {denom}</span>
                                        <span className="text-gray-400">×</span>
                                        <Input
                                            className="h-8 w-20 text-right font-mono font-bold bg-white"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={countsUSD[denom] || ''}
                                            onChange={(e) => handleCountChange('USD', denom, e.target.value)}
                                        />
                                        <span className="text-gray-400">=</span>
                                        <span className="flex-1 text-right font-mono text-sm">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(denom * (countsUSD[denom] || 0))}
                                        </span>
                                    </div>
                                ))}
                                <div className="border-t mt-3 pt-2 flex justify-between font-bold text-sm">
                                    <span>Total US$:</span>
                                    <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalUSD)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Divisas EUR */}
                    <div className={`print-breakdown-section ${!hasEUR ? 'no-print-eur' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold uppercase text-gray-600">Desglose Divisas €</h4>
                            <div className="flex items-center space-x-2 no-print">
                                <Checkbox id="eur" checked={hasEUR} onCheckedChange={(c: boolean) => setHasEUR(c)} />
                                <Label htmlFor="eur" className="text-xs">Maneja EUR</Label>
                            </div>
                        </div>
                        {hasEUR && (
                            <div className="border rounded-lg p-3 bg-gray-50/50">
                                {BILLS_EUR.map(denom => (
                                    <div key={denom} className={`print-bill-row flex items-center gap-2 mb-1.5 ${!countsEUR[denom] ? 'hide-zero' : ''}`}>
                                        <span className="w-12 text-right font-mono text-sm">€ {denom}</span>
                                        <span className="text-gray-400">×</span>
                                        <Input
                                            className="h-8 w-20 text-right font-mono font-bold bg-white"
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={countsEUR[denom] || ''}
                                            onChange={(e) => handleCountChange('EUR', denom, e.target.value)}
                                        />
                                        <span className="text-gray-400">=</span>
                                        <span className="flex-1 text-right font-mono text-sm">
                                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(denom * (countsEUR[denom] || 0))}
                                        </span>
                                    </div>
                                ))}
                                <div className="border-t mt-3 pt-2 flex justify-between font-bold text-sm">
                                    <span>Total €:</span>
                                    <span>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalEUR)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Resumen de Cuadre en Vivo */}
                <div className="mt-6 border rounded-lg p-4 bg-gray-50 max-w-lg print-summary">
                    <h4 className="font-bold text-base border-b pb-2 text-gray-800">Resumen de Cuadre del Turno</h4>
                    <div className="grid grid-cols-2 gap-y-1.5 text-sm pt-2">
                        <div className="text-gray-600">Fondo Inicial:</div>
                        <div className="text-right font-mono">{formatCurrency(openingBalance)}</div>

                        <div className="text-gray-600">(+) Cobros en Efectivo:</div>
                        <div className="text-right font-mono text-green-700">+{formatCurrency(cashCollected)}</div>

                        <div className="text-gray-600">(-) Total Gastos de Caja:</div>
                        <div className="text-right font-mono text-red-600">-{formatCurrency(totalExpenses)}</div>

                        <div className="col-span-2 border-t pt-1.5 font-semibold text-gray-700 flex justify-between">
                            <span>(=) Efectivo Teórico Esperado:</span>
                            <span className="font-mono">{formatCurrency(expectedCash)}</span>
                        </div>

                        <div className="col-span-2 font-semibold text-gray-700 flex justify-between">
                            <span>(=) Efectivo Físico Arqueado:</span>
                            <span className="font-mono">{formatCurrency(totalRD)}</span>
                        </div>

                        <div className="col-span-2 border-t pt-2 mt-1">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-base">
                                    {discrepancy === 0 ? "Cuadre Exacto:" : discrepancy > 0 ? "Sobrante en Caja:" : "Faltante en Caja:"}
                                </span>
                                <span className={`font-mono text-lg font-bold ${
                                    discrepancy === 0 ? 'text-green-700' : discrepancy < 0 ? 'text-red-600' : 'text-yellow-600'
                                }`}>
                                    {discrepancy < 0 ? '-' : discrepancy > 0 ? '+' : ''}{formatCurrency(Math.abs(discrepancy))}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* DETALLES DE TRANSACCIONES DEL TURNO */}
            <div className="space-y-6">
                <div className="no-print">
                    <h3 className="text-xl font-bold text-gray-900">Movimientos y Transacciones del Turno</h3>
                    <p className="text-xs text-gray-500">
                        Detalle completo de todo lo facturado (ventas), cobrado en caja y egresos registrados.
                    </p>
                </div>

                {/* 1. VENTAS / FACTURAS DEL TURNO (TODO LO QUE VENDÍ) */}
                <div className="border rounded-xl p-4 bg-white shadow-sm print-section">
                    <div className="print-section-title">
                        1. Facturación y Ventas del Turno (Todo lo Vendido)
                    </div>
                    <h4 className="font-bold text-base mb-3 flex items-center justify-between no-print">
                        <span className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-blue-600" />
                            <span>Ventas / Facturas Emitidas ({invoices.length})</span>
                        </span>
                        <span className="text-sm font-semibold text-blue-700 font-mono">
                            Total Facturado: {formatCurrency(totalBilled)}
                        </span>
                    </h4>
                    <div className="max-h-72 overflow-y-auto border rounded-md print-table-container">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="py-2 font-bold">Factura #</TableHead>
                                    <TableHead className="py-2 font-bold">Hora</TableHead>
                                    <TableHead className="py-2 font-bold">Cliente</TableHead>
                                    <TableHead className="py-2 font-bold">Condición</TableHead>
                                    <TableHead className="py-2 font-bold">Estado</TableHead>
                                    <TableHead className="py-2 font-bold text-right">Total Facturado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-xs text-gray-500 py-4">
                                            No se han emitido facturas en este turno
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    invoices.map((inv) => (
                                        <TableRow key={inv.id} className="text-xs">
                                            <TableCell className="font-mono font-bold text-blue-700">
                                                #{String(inv.sequenceNumber).padStart(6, '0')}
                                            </TableCell>
                                            <TableCell>
                                                {format(new Date(inv.createdAt), "HH:mm", { locale: es })}
                                            </TableCell>
                                            <TableCell className="font-medium max-w-[180px] truncate" title={inv.clientName || "Consumidor Final"}>
                                                {inv.clientName || "Consumidor Final"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] uppercase">
                                                    {inv.paymentMethod || 'CASH'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-[10px] uppercase ${
                                                        inv.status === 'PAID'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-amber-100 text-amber-800'
                                                    }`}
                                                >
                                                    {inv.status === 'PAID' ? 'PAGADA' : inv.status === 'PENDING' ? 'PENDIENTE' : (inv.status || 'EMITIDA')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-bold text-gray-900">
                                                {formatCurrency(inv.total)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="pt-2 text-xs text-muted-foreground flex justify-between font-mono">
                        <span>Total de Facturas: {invoices.length}</span>
                        <span className="font-bold text-gray-900">Total Vendido: {formatCurrency(totalBilled)}</span>
                    </div>
                </div>

                {/* 2. COBROS RECIBIDOS Y 3. GASTOS DE CAJA */}
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Cobros Realizados (Todo lo que Cobré) */}
                    <div className="border rounded-xl p-4 bg-white shadow-sm print-section">
                        <div className="print-section-title">
                            2. Cobros Recibidos en Caja (Todo lo Cobrado)
                        </div>
                        <h4 className="font-bold text-base mb-3 flex items-center justify-between no-print">
                            <span className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-green-600" />
                                <span>Cobros en este Turno ({payments.length})</span>
                            </span>
                            <span className="text-sm text-green-700 font-mono font-semibold">
                                Total: {formatCurrency(totalCollected)}
                            </span>
                        </h4>
                        <div className="max-h-72 overflow-y-auto border rounded-md print-table-container">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="py-2 font-bold">Hora</TableHead>
                                        <TableHead className="py-2 font-bold">Factura</TableHead>
                                        <TableHead className="py-2 font-bold">Cliente</TableHead>
                                        <TableHead className="py-2 font-bold">Método</TableHead>
                                        <TableHead className="py-2 font-bold text-right">Monto</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payments.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-xs text-gray-500 py-4">
                                                No hay cobros registrados en este turno
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        payments.map((p) => (
                                            <TableRow key={p.id} className="text-xs">
                                                <TableCell>{format(new Date(p.date), "HH:mm", { locale: es })}</TableCell>
                                                <TableCell className="font-mono font-semibold text-blue-700">
                                                    {p.invoiceSequenceNumber ? `#${String(p.invoiceSequenceNumber).padStart(6, '0')}` : "-"}
                                                </TableCell>
                                                <TableCell className="max-w-[120px] truncate" title={p.clientName || "Consumidor Final"}>
                                                    {p.clientName || "Consumidor Final"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[10px] uppercase">
                                                        {p.method || 'CASH'}
                                                    </Badge>
                                                    {p.reference && (
                                                        <span className="block text-[9px] text-muted-foreground font-mono truncate max-w-[80px]">
                                                            Ref: {p.reference}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold text-green-700">
                                                    +{formatCurrency(p.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="pt-2 text-xs text-muted-foreground flex justify-between font-mono">
                            <span>Efec: {formatCurrency(cashCollected)} | Banco/Otros: {formatCurrency(otherCollected)}</span>
                            <span className="font-bold text-green-800">Total: {formatCurrency(totalCollected)}</span>
                        </div>
                    </div>

                    {/* Gastos del Turno */}
                    <div className="border rounded-xl p-4 bg-white shadow-sm print-section">
                        <div className="print-section-title">
                            3. Gastos y Egresos de Caja
                        </div>
                        <h4 className="font-bold text-base mb-3 flex items-center justify-between no-print">
                            <span className="flex items-center gap-2">
                                <Minus className="h-5 w-5 text-red-600" />
                                <span>Gastos en este Turno ({expenses.length})</span>
                            </span>
                            <span className="text-sm text-red-600 font-mono font-semibold">
                                Total: -{formatCurrency(totalExpenses)}
                            </span>
                        </h4>
                        <div className="max-h-72 overflow-y-auto border rounded-md print-table-container">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="py-2 font-bold">Hora</TableHead>
                                        <TableHead className="py-2 font-bold">Descripción</TableHead>
                                        <TableHead className="py-2 font-bold text-right">Monto</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {expenses.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-xs text-gray-500 py-4">
                                                No hay gastos registrados en este turno
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        expenses.map((e) => (
                                            <TableRow key={e.id} className="text-xs">
                                                <TableCell>{format(new Date(e.date), "HH:mm", { locale: es })}</TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={e.description || ""}>
                                                    {e.description}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold text-red-600">
                                                    -{formatCurrency(e.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="pt-2 text-xs text-muted-foreground flex justify-between font-mono">
                            <span>Egresos: {expenses.length}</span>
                            <span className="font-bold text-red-700">Total: -{formatCurrency(totalExpenses)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCIÓN PARA CERRAR EL TURNO */}
            <div className="border rounded-xl p-6 bg-gray-50 no-print space-y-4">
                <div className="flex items-center gap-2">
                    <Save className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-bold text-gray-900">Finalizar y Cerrar Turno #{shift.shiftNumber}</h3>
                </div>

                {closeSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700 text-sm">
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        <span>Turno cerrado exitosamente. Se ha generado el reporte para impresión.</span>
                    </div>
                )}

                {closeError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700 text-sm">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <span>{closeError}</span>
                    </div>
                )}

                <div>
                    <Label htmlFor="close-notes" className="text-sm font-medium">Notas u observaciones del cierre (opcional)</Label>
                    <Textarea
                        id="close-notes"
                        rows={2}
                        value={closeNotes}
                        onChange={(e) => setCloseNotes(e.target.value)}
                        placeholder="Observaciones de entrega, justificación de diferencias, etc..."
                        className="mt-1 bg-white"
                    />
                </div>

                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-gray-500">
                        Al confirmar el cierre, la sesión del turno se bloqueará y quedará registrada en el historial.
                    </p>
                    <Button
                        onClick={handleCloseShift}
                        disabled={isClosing}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-5 text-base"
                    >
                        {isClosing ? (
                            <>
                                <Save className="mr-2 h-4 w-4 animate-spin" />
                                Guardando Cierre...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Cerrar Turno e Imprimir Reporte
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Footer con firmas para impresión */}
            <div className="print-footer">
                <div className="print-signature">
                    <div className="print-signature-line">Entregado por: {shift.openedByName || currentUser.name}</div>
                </div>
                <div className="print-signature">
                    <div className="print-signature-line">Recibido por (Supervisor / Administración)</div>
                </div>
            </div>
        </div>
    )
}