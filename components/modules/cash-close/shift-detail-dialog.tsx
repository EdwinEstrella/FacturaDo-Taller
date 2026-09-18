"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import { Eye, Printer, ShoppingCart, DollarSign, Minus } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { CashShiftRecord } from "@/actions/cash-shift-actions"

export function ShiftDetailDialog({ shift }: { shift: CashShiftRecord }) {
    const isClosed = shift.status === 'CLOSED'
    const openedAtFormatted = format(new Date(shift.openedAt), "dd/MM/yyyy HH:mm", { locale: es })
    const closedAtFormatted = shift.closedAt ? format(new Date(shift.closedAt), "dd/MM/yyyy HH:mm", { locale: es }) : "En curso"

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    Detalle
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between pr-6">
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-xl">Turno #{shift.shiftNumber}</DialogTitle>
                            <Badge className={isClosed ? "bg-gray-600" : "bg-emerald-600"}>
                                {isClosed ? "CERRADO" : "EN CURSO"}
                            </Badge>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.print()}
                            className="gap-1.5"
                            title="Imprimir reporte"
                        >
                            <Printer className="h-3.5 w-3.5" />
                            Imprimir
                        </Button>
                    </div>
                    <DialogDescription>
                        Apertura: {openedAtFormatted} por <strong>{shift.openedByName || "Usuario"}</strong>
                        {isClosed && ` — Cierre: ${closedAtFormatted}`}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* Resumen Financiero */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-lg text-sm">
                        <div>
                            <p className="text-xs text-muted-foreground">Fondo Apertura</p>
                            <p className="font-bold">{formatCurrency(Number(shift.openingBalance))}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Facturado (Ventas)</p>
                            <p className="font-bold text-blue-700">{formatCurrency(Number(shift.totalBilled))}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Cobrado Total</p>
                            <p className="font-bold text-green-700">{formatCurrency(Number(shift.totalCollected))}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Gastos de Turno</p>
                            <p className="font-bold text-red-600">-{formatCurrency(Number(shift.totalExpenses))}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Efectivo Esperado</p>
                            <p className="font-bold text-blue-700">{formatCurrency(Number(shift.expectedCash))}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Efectivo Físico Arqueado</p>
                            <p className="font-bold">{formatCurrency(Number(shift.actualCash))}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">Diferencia de Cuadre</p>
                            <p className={`font-bold ${
                                Number(shift.discrepancy) === 0
                                    ? "text-green-700"
                                    : Number(shift.discrepancy) < 0
                                        ? "text-red-600"
                                        : "text-yellow-600"
                            }`}>
                                {Number(shift.discrepancy) === 0 ? "Cuadrado (0.00)" : `${Number(shift.discrepancy) < 0 ? 'Faltante: ' : 'Sobrante: '}${formatCurrency(Math.abs(Number(shift.discrepancy)))}`}
                            </p>
                        </div>
                    </div>

                    {/* Notas */}
                    {shift.notes && (
                        <div className="p-3 bg-blue-50/60 rounded-md border text-sm">
                            <p className="font-semibold text-xs text-blue-900 mb-1">Observaciones:</p>
                            <p className="text-gray-700">{shift.notes}</p>
                        </div>
                    )}

                    {/* 1. FACTURAS / VENTAS DEL TURNO (TODO LO QUE VENDÍ) */}
                    <div className="border rounded-md p-3">
                        <h4 className="font-semibold text-sm mb-2 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <ShoppingCart className="h-4 w-4 text-blue-600" />
                                <span>Facturas Emitidas / Ventas ({shift.invoicesData?.length || 0})</span>
                            </span>
                            <span className="font-mono text-blue-700">
                                Total: {formatCurrency(Number(shift.totalBilled))}
                            </span>
                        </h4>
                        <div className="max-h-56 overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">Factura #</TableHead>
                                        <TableHead className="text-xs">Hora</TableHead>
                                        <TableHead className="text-xs">Cliente</TableHead>
                                        <TableHead className="text-xs">Condición</TableHead>
                                        <TableHead className="text-xs">Estado</TableHead>
                                        <TableHead className="text-xs text-right">Total Facturado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(shift.invoicesData || []).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-3">
                                                Sin registros de facturación en este turno
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        (shift.invoicesData || []).map((inv, idx) => (
                                            <TableRow key={idx} className="text-xs">
                                                <TableCell className="font-mono font-bold text-blue-700">
                                                    #{String(inv.sequenceNumber).padStart(6, '0')}
                                                </TableCell>
                                                <TableCell>
                                                    {inv.createdAt ? format(new Date(inv.createdAt), "HH:mm") : "-"}
                                                </TableCell>
                                                <TableCell className="max-w-[150px] truncate" title={inv.clientName || "Consumidor Final"}>
                                                    {inv.clientName || "Consumidor Final"}
                                                </TableCell>
                                                <TableCell className="uppercase">{inv.paymentMethod || 'CASH'}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="secondary"
                                                        className={`text-[9px] uppercase ${
                                                            inv.status === 'PAID'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-amber-100 text-amber-800'
                                                        }`}
                                                    >
                                                        {inv.status === 'PAID' ? 'PAGADA' : inv.status === 'PENDING' ? 'PENDIENTE' : (inv.status || 'EMITIDA')}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold">
                                                    {formatCurrency(inv.total)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* 2. COBROS Y 3. GASTOS */}
                    <div className="grid md:grid-cols-2 gap-4">
                        {/* Cobros */}
                        <div className="border rounded-md p-3">
                            <h4 className="font-semibold text-sm mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <DollarSign className="h-4 w-4 text-green-600" />
                                    <span>Cobros en Caja ({shift.paymentsData?.length || 0})</span>
                                </span>
                                <span className="font-mono text-green-700">
                                    {formatCurrency(Number(shift.totalCollected))}
                                </span>
                            </h4>
                            <div className="max-h-56 overflow-y-auto border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Hora</TableHead>
                                            <TableHead className="text-xs">Factura</TableHead>
                                            <TableHead className="text-xs">Cliente</TableHead>
                                            <TableHead className="text-xs">Método</TableHead>
                                            <TableHead className="text-xs text-right">Monto</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(shift.paymentsData || []).length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-3">Sin cobros registrados</TableCell>
                                            </TableRow>
                                        ) : (
                                            (shift.paymentsData || []).map((p, idx) => (
                                                <TableRow key={idx} className="text-xs">
                                                    <TableCell>{p.date ? format(new Date(p.date), "HH:mm") : "-"}</TableCell>
                                                    <TableCell className="font-mono font-semibold text-blue-700">
                                                        {p.invoiceSequenceNumber ? `#${String(p.invoiceSequenceNumber).padStart(6, '0')}` : "-"}
                                                    </TableCell>
                                                    <TableCell className="max-w-[120px] truncate" title={p.clientName || "Consumidor Final"}>
                                                        {p.clientName || "Consumidor Final"}
                                                    </TableCell>
                                                    <TableCell className="uppercase">{p.method || 'CASH'}</TableCell>
                                                    <TableCell className="text-right font-mono font-medium text-green-700">+{formatCurrency(p.amount)}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Gastos */}
                        <div className="border rounded-md p-3">
                            <h4 className="font-semibold text-sm mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Minus className="h-4 w-4 text-red-600" />
                                    <span>Gastos de Caja ({shift.expensesData?.length || 0})</span>
                                </span>
                                <span className="font-mono text-red-600">
                                    -{formatCurrency(Number(shift.totalExpenses))}
                                </span>
                            </h4>
                            <div className="max-h-56 overflow-y-auto border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Hora</TableHead>
                                            <TableHead className="text-xs">Descripción</TableHead>
                                            <TableHead className="text-xs text-right">Monto</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(shift.expensesData || []).length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-3">Sin gastos registrados</TableCell>
                                            </TableRow>
                                        ) : (
                                            (shift.expensesData || []).map((e, idx) => (
                                                <TableRow key={idx} className="text-xs">
                                                    <TableCell>{e.date ? format(new Date(e.date), "HH:mm") : "-"}</TableCell>
                                                    <TableCell className="truncate max-w-[160px]" title={e.description || ""}>{e.description}</TableCell>
                                                    <TableCell className="text-right font-mono font-medium text-red-600">-{formatCurrency(e.amount)}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
