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
import { formatCurrency, formatQuantity } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
        lastClosedShift ? Number(lastClosedShift.actualCash ?? lastClosedShift.expectedCash ?? 0) : 0
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

    // Serialize the counted bills so the print route can render them in the arqueo (only non-zero).
    const buildCountsQuery = () => {
        const enc = (counts: Record<number, number>) =>
            Object.entries(counts)
                .filter(([, qty]) => Number(qty) > 0)
                .map(([denom, qty]) => `${denom}:${qty}`)
                .join(",")

        const params = new URLSearchParams()
        const rd = enc(countsRD)
        if (rd) params.set("rd", rd)
        if (hasUSD) { const usd = enc(countsUSD); if (usd) params.set("usd", usd) }
        if (hasEUR) { const eur = enc(countsEUR); if (eur) params.set("eur", eur) }
        if (closeNotes.trim()) params.set("cn", closeNotes.trim())

        const qs = params.toString()
        return qs ? `?${qs}` : ""
    }

    // Print via a hidden iframe: same page, no new tab, and isolated from the dashboard shell.
    const printReport = (query = "") => {
        if (!shift) return
        const url = `/daily-close/print/${shift.id}${query}`
        const existing = document.getElementById("cc-print-frame")
        if (existing) existing.remove()

        const iframe = document.createElement("iframe")
        iframe.id = "cc-print-frame"
        iframe.style.position = "fixed"
        iframe.style.right = "0"
        iframe.style.bottom = "0"
        iframe.style.width = "0"
        iframe.style.height = "0"
        iframe.style.border = "0"
        iframe.onload = () => {
            try {
                iframe.contentWindow?.focus()
                iframe.contentWindow?.print()
            } catch {
                /* noop */
            }
        }
        iframe.src = url
        document.body.appendChild(iframe)
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
            // Print in place (hidden iframe) — no new tab. The shift is now CLOSED, so the route
            // renders the saved snapshot (including the counted bills), ignoring the query.
            setTimeout(() => {
                printReport()
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
            <div className="flex-1 space-y-6 max-w-4xl mx-auto">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Cierre de Caja</h2>
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
    const discrepancy = Math.round((totalRD - expectedCash) * 100) / 100
    const discrepancyTone = discrepancy === 0 ? "green" : discrepancy < 0 ? "red" : "amber"

    return (
        <div className="flex-1 space-y-8">
            {/* Encabezado */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-3xl font-bold tracking-tight">Turno #{shift.shiftNumber}</h2>
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1.5 px-3 py-1 font-semibold">
                            <span className="size-2 rounded-full bg-white inline-block animate-pulse"></span>
                            EN CURSO
                        </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1">
                        <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            Iniciado el {format(openedDate, "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <UserCheck className="h-4 w-4" />
                            Apertura por <strong className="text-foreground">{shift.openedByName || "Usuario"}</strong>
                        </span>
                    </div>
                    {shift.openingNotes && (
                        <p className="text-sm italic text-muted-foreground">&ldquo;{shift.openingNotes}&rdquo;</p>
                    )}
                </div>

                {/* Acciones Rápidas */}
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" onClick={() => printReport(buildCountsQuery())}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir Reporte
                    </Button>

                    <Dialog open={expenseModalOpen} onOpenChange={setExpenseModalOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">
                                <Minus className="mr-2 h-4 w-4" />
                                Registrar Gasto
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
                            <form onSubmit={handleQuickExpense} className="space-y-5 py-2">
                                <div className="space-y-2">
                                    <Label htmlFor="quick-desc" className="text-sm font-semibold">Descripción o Motivo del Gasto *</Label>
                                    <Input
                                        id="quick-desc"
                                        value={quickExpenseDesc}
                                        onChange={(e) => setQuickExpenseDesc(e.target.value)}
                                        placeholder="Ej: Pago de delivery, compra de insumos, café..."
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="quick-amount" className="text-sm font-semibold">Monto en RD$ *</Label>
                                    <CurrencyInput
                                        id="quick-amount"
                                        value={quickExpenseAmount}
                                        onValueChange={(val) => setQuickExpenseAmount(val)}
                                        placeholder="0.00"
                                        className="focus-within:ring-red-500 focus-within:border-red-500"
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

            {/* Indicadores del turno */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Fondo inicial"
                    value={formatCurrency(openingBalance)}
                    hint="Efectivo al abrir la caja"
                    icon={<Wallet className="h-5 w-5" />}
                />
                <StatCard
                    label="Facturado"
                    value={formatCurrency(totalBilled)}
                    hint={`${invoices.length} ${invoices.length === 1 ? "factura emitida" : "facturas emitidas"}`}
                    icon={<Receipt className="h-5 w-5" />}
                />
                <StatCard
                    label="Cobrado"
                    value={formatCurrency(totalCollected)}
                    hint={`Efectivo ${formatCurrency(cashCollected)} · Banco ${formatCurrency(otherCollected)}`}
                    icon={<DollarSign className="h-5 w-5" />}
                    tone="green"
                />
                <StatCard
                    label="Gastos"
                    value={`-${formatCurrency(totalExpenses)}`}
                    hint={`${expenses.length} ${expenses.length === 1 ? "egreso registrado" : "egresos registrados"}`}
                    icon={<Minus className="h-5 w-5" />}
                    tone="red"
                />
            </div>

            {/* Arqueo + Cuadre y cierre */}
            <div className="grid gap-6 lg:grid-cols-5 items-start">
                <Card className="lg:col-span-3">
                    <CardHeader className="border-b">
                        <CardTitle className="text-xl">Arqueo Físico de Caja</CardTitle>
                        <CardDescription>
                            Contá los billetes y monedas en caja. El total se compara con el efectivo esperado.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <BillCounter
                            title="Pesos dominicanos (RD$)"
                            prefix="RD$"
                            denoms={BILLS_RD}
                            counts={countsRD}
                            total={formatCurrency(totalRD)}
                            onChange={(denom, value) => handleCountChange('RD', denom, value)}
                            formatAmount={(n) => formatCurrency(n)}
                        />

                        <div className="space-y-4 pt-6 border-t">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h4 className="text-sm font-semibold text-gray-800">Divisas</h4>
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <Checkbox id="usd" checked={hasUSD} onCheckedChange={(c: boolean) => setHasUSD(c)} />
                                        <Label htmlFor="usd" className="text-sm font-normal">Maneja US$</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox id="eur" checked={hasEUR} onCheckedChange={(c: boolean) => setHasEUR(c)} />
                                        <Label htmlFor="eur" className="text-sm font-normal">Maneja €</Label>
                                    </div>
                                </div>
                            </div>

                            {!hasUSD && !hasEUR && (
                                <p className="text-sm text-muted-foreground">
                                    Marcá una divisa si hay dólares o euros en caja.
                                </p>
                            )}

                            {hasUSD && (
                                <BillCounter
                                    title="Dólares (US$)"
                                    prefix="US$"
                                    denoms={BILLS_USD}
                                    counts={countsUSD}
                                    total={formatUSD(totalUSD)}
                                    onChange={(denom, value) => handleCountChange('USD', denom, value)}
                                    formatAmount={formatUSD}
                                />
                            )}

                            {hasEUR && (
                                <BillCounter
                                    title="Euros (€)"
                                    prefix="€"
                                    denoms={BILLS_EUR}
                                    counts={countsEUR}
                                    total={formatEUR(totalEUR)}
                                    onChange={(denom, value) => handleCountChange('EUR', denom, value)}
                                    formatAmount={formatEUR}
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="lg:col-span-2 space-y-6 lg:sticky lg:top-6">
                    {/* Resumen de Cuadre en Vivo */}
                    <Card>
                        <CardHeader className="border-b">
                            <CardTitle className="text-xl">Cuadre del Turno</CardTitle>
                            <CardDescription>Fondo + cobros en efectivo − gastos</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <SummaryLine label="Fondo inicial" value={formatCurrency(openingBalance)} />
                            <SummaryLine label="(+) Cobros en efectivo" value={`+${formatCurrency(cashCollected)}`} className="text-green-700" />
                            <SummaryLine label="(−) Gastos de caja" value={`-${formatCurrency(totalExpenses)}`} className="text-red-600" />

                            <div className="border-t pt-3 space-y-3">
                                <SummaryLine label="Efectivo esperado" value={formatCurrency(expectedCash)} strong />
                                <SummaryLine label="Efectivo contado" value={formatCurrency(totalRD)} strong />
                            </div>

                            <div
                                className={`mt-2 rounded-lg border px-4 py-4 flex items-center justify-between gap-3 ${
                                    discrepancyTone === "green"
                                        ? "bg-green-50 border-green-200 text-green-800"
                                        : discrepancyTone === "red"
                                            ? "bg-red-50 border-red-200 text-red-700"
                                            : "bg-amber-50 border-amber-200 text-amber-800"
                                }`}
                            >
                                <span className="font-semibold">
                                    {discrepancy === 0 ? "Cuadre exacto" : discrepancy > 0 ? "Sobrante en caja" : "Faltante en caja"}
                                </span>
                                <span className="font-mono text-xl font-bold">
                                    {discrepancy < 0 ? '-' : discrepancy > 0 ? '+' : ''}{formatCurrency(Math.abs(discrepancy))}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Cerrar el turno */}
                    <Card>
                        <CardHeader className="border-b">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Save className="h-5 w-5 text-blue-600" />
                                Cerrar Turno #{shift.shiftNumber}
                            </CardTitle>
                            <CardDescription>
                                Al confirmar, el turno se bloquea y queda registrado en el historial.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
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

                            <div className="space-y-2">
                                <Label htmlFor="close-notes" className="text-sm font-medium">Notas del cierre (opcional)</Label>
                                <Textarea
                                    id="close-notes"
                                    rows={3}
                                    value={closeNotes}
                                    onChange={(e) => setCloseNotes(e.target.value)}
                                    placeholder="Observaciones de entrega, justificación de diferencias, etc..."
                                />
                            </div>

                            <Button
                                onClick={handleCloseShift}
                                disabled={isClosing}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 text-base"
                            >
                                <Save className={`mr-2 h-4 w-4 ${isClosing ? "animate-spin" : ""}`} />
                                {isClosing ? "Guardando Cierre..." : "Cerrar Turno e Imprimir"}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Movimientos del turno */}
            <Card>
                <CardHeader className="border-b">
                    <CardTitle className="text-xl">Movimientos del Turno</CardTitle>
                    <CardDescription>
                        Todo lo facturado, cobrado y gastado desde la apertura.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="sales" className="gap-6 min-w-0">
                        <TabsList className="h-10 w-full sm:w-fit">
                            <TabsTrigger value="sales" className="px-2 sm:px-4">
                                <ShoppingCart className="hidden sm:block h-4 w-4" />
                                Ventas ({invoices.length})
                            </TabsTrigger>
                            <TabsTrigger value="payments" className="px-2 sm:px-4">
                                <DollarSign className="hidden sm:block h-4 w-4" />
                                Cobros ({payments.length})
                            </TabsTrigger>
                            <TabsTrigger value="expenses" className="px-2 sm:px-4">
                                <Minus className="hidden sm:block h-4 w-4" />
                                Gastos ({expenses.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* Ventas con detalle de ítems */}
                        <TabsContent value="sales" className="space-y-4 min-w-0">
                            {invoices.length === 0 ? (
                                <EmptyState text="No se han emitido facturas en este turno" />
                            ) : (
                                invoices.map((inv) => (
                                    <div key={inv.id} className="border rounded-lg overflow-hidden">
                                        <div className="flex items-center justify-between gap-4 flex-wrap bg-gray-50 px-4 py-3 border-b">
                                            <div className="flex items-center gap-3 flex-wrap text-sm">
                                                <span className="font-mono font-bold text-blue-700">
                                                    #{String(inv.sequenceNumber).padStart(6, '0')}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    {format(new Date(inv.createdAt), "HH:mm", { locale: es })}
                                                </span>
                                                <span className="font-medium max-w-[240px] truncate" title={inv.clientName || "Consumidor Final"}>
                                                    {inv.clientName || "Consumidor Final"}
                                                </span>
                                                <Badge variant="outline" className="text-[11px]">
                                                    {paymentMethodLabel(inv.paymentMethod)}
                                                </Badge>
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-[11px] ${
                                                        inv.status === 'PAID'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-amber-100 text-amber-800'
                                                    }`}
                                                >
                                                    {inv.status === 'PAID' ? 'Pagada' : inv.status === 'PENDING' ? 'Pendiente' : (inv.status || 'Emitida')}
                                                </Badge>
                                            </div>
                                            <span className="font-mono font-bold text-base">{formatCurrency(inv.total)}</span>
                                        </div>

                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="pl-4 whitespace-normal">Producto / Servicio</TableHead>
                                                    <TableHead className="text-right">Cant.</TableHead>
                                                    <TableHead className="text-right hidden sm:table-cell">Precio</TableHead>
                                                    <TableHead className="text-right pr-4">Subtotal</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {inv.items && inv.items.length > 0 ? (
                                                    inv.items.map((it, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell className="pl-4 whitespace-normal break-words">
                                                                {it.productName}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono">{formatQuantity(it.quantity)}</TableCell>
                                                            <TableCell className="text-right font-mono hidden sm:table-cell">{formatCurrency(it.price)}</TableCell>
                                                            <TableCell className="text-right font-mono font-semibold pr-4">
                                                                {formatCurrency(it.price * it.quantity)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                                                            Sin desglose de ítems
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ))
                            )}
                            <TabFooter
                                left={`${invoices.length} ${invoices.length === 1 ? "factura" : "facturas"}`}
                                right={`Total vendido: ${formatCurrency(totalBilled)}`}
                            />
                        </TabsContent>

                        {/* Cobros */}
                        <TabsContent value="payments" className="space-y-4 min-w-0">
                            {payments.length === 0 ? (
                                <EmptyState text="No hay cobros registrados en este turno" />
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="pl-4">Hora</TableHead>
                                                <TableHead>Factura</TableHead>
                                                <TableHead>Cliente</TableHead>
                                                <TableHead>Método</TableHead>
                                                <TableHead className="text-right pr-4">Monto</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {payments.map((p) => (
                                                <TableRow key={p.id}>
                                                    <TableCell className="pl-4">{format(new Date(p.date), "HH:mm", { locale: es })}</TableCell>
                                                    <TableCell className="font-mono font-semibold text-blue-700">
                                                        {p.invoiceSequenceNumber ? `#${String(p.invoiceSequenceNumber).padStart(6, '0')}` : "-"}
                                                    </TableCell>
                                                    <TableCell className="max-w-[220px] truncate" title={p.clientName || "Consumidor Final"}>
                                                        {p.clientName || "Consumidor Final"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-[11px]">
                                                            {paymentMethodLabel(p.method)}
                                                        </Badge>
                                                        {p.reference && (
                                                            <span className="block text-xs text-muted-foreground font-mono truncate max-w-[140px] mt-1">
                                                                Ref: {p.reference}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-green-700 pr-4">
                                                        +{formatCurrency(p.amount)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                            <TabFooter
                                left={`Efectivo ${formatCurrency(cashCollected)} · Banco / otros ${formatCurrency(otherCollected)}`}
                                right={`Total cobrado: ${formatCurrency(totalCollected)}`}
                                className="text-green-700"
                            />
                        </TabsContent>

                        {/* Gastos */}
                        <TabsContent value="expenses" className="space-y-4 min-w-0">
                            {expenses.length === 0 ? (
                                <EmptyState text="No hay gastos registrados en este turno" />
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="pl-4">Hora</TableHead>
                                                <TableHead>Descripción</TableHead>
                                                <TableHead className="text-right pr-4">Monto</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {expenses.map((e) => (
                                                <TableRow key={e.id}>
                                                    <TableCell className="pl-4">{format(new Date(e.date), "HH:mm", { locale: es })}</TableCell>
                                                    <TableCell className="max-w-[420px] truncate" title={e.description || ""}>
                                                        {e.description}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-red-600 pr-4">
                                                        -{formatCurrency(e.amount)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                            <TabFooter
                                left={`${expenses.length} ${expenses.length === 1 ? "egreso" : "egresos"}`}
                                right={`Total gastos: -${formatCurrency(totalExpenses)}`}
                                className="text-red-600"
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}

const formatUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const formatEUR = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Efectivo",
    TRANSFER: "Transferencia",
    CARD: "Tarjeta",
    CHECK: "Cheque",
    CREDIT: "Crédito",
}

const paymentMethodLabel = (method?: string | null) => PAYMENT_METHOD_LABELS[method || "CASH"] || method || "Efectivo"

const STAT_TONES = {
    neutral: { value: "text-gray-900", icon: "bg-gray-100 text-gray-600" },
    green: { value: "text-green-700", icon: "bg-green-50 text-green-600" },
    red: { value: "text-red-600", icon: "bg-red-50 text-red-600" },
}

function StatCard({ label, value, hint, icon, tone = "neutral" }: {
    label: string
    value: string
    hint: string
    icon: React.ReactNode
    tone?: keyof typeof STAT_TONES
}) {
    const t = STAT_TONES[tone]
    return (
        <Card className="py-0">
            <CardContent className="p-5 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">{label}</p>
                    <p className={`text-2xl font-bold tabular-nums truncate ${t.value}`}>{value}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                <div className={`rounded-lg p-2.5 shrink-0 ${t.icon}`}>{icon}</div>
            </CardContent>
        </Card>
    )
}

function BillCounter({ title, prefix, denoms, counts, total, onChange, formatAmount }: {
    title: string
    prefix: string
    denoms: number[]
    counts: Record<number, number>
    total: string
    onChange: (denom: number, value: string) => void
    formatAmount: (n: number) => string
}) {
    return (
        <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                {[...denoms].reverse().map(denom => (
                    <div key={denom} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3">
                        <span className="font-mono font-semibold text-sm text-gray-700">{prefix} {denom}</span>
                        <Input
                            className="h-9 text-right font-mono"
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder="0"
                            aria-label={`Cantidad de ${prefix} ${denom}`}
                            value={counts[denom] || ''}
                            onChange={(e) => onChange(denom, e.target.value)}
                        />
                        <span className={`w-28 text-right font-mono text-sm ${counts[denom] ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                            {formatAmount(denom * (counts[denom] || 0))}
                        </span>
                    </div>
                ))}
            </div>
            <div className="flex justify-between items-center rounded-lg bg-gray-50 border px-4 py-3">
                <span className="font-semibold text-gray-700">Total contado</span>
                <span className="font-mono text-lg font-bold">{total}</span>
            </div>
        </div>
    )
}

function SummaryLine({ label, value, className = "", strong = false }: {
    label: string
    value: string
    className?: string
    strong?: boolean
}) {
    return (
        <div className={`flex justify-between gap-4 ${strong ? "font-semibold text-gray-900 text-base" : "text-gray-600"}`}>
            <span>{label}</span>
            <span className={`font-mono ${className}`}>{value}</span>
        </div>
    )
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="text-center text-sm text-muted-foreground py-12 border border-dashed rounded-lg">
            {text}
        </div>
    )
}

function TabFooter({ left, right, className = "" }: { left: string; right: string; className?: string }) {
    return (
        <div className="flex flex-wrap justify-between gap-2 pt-4 border-t text-sm">
            <span className="text-muted-foreground">{left}</span>
            <span className={`font-semibold font-mono ${className}`}>{right}</span>
        </div>
    )
}
