import { createServerClient } from "@/lib/insforge/client"
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
import { Badge } from "@/components/ui/badge"
import { ShiftDetailDialog } from "@/components/modules/cash-close/shift-detail-dialog"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { CashShiftRecord } from "@/actions/cash-shift-actions"

export const dynamic = 'force-dynamic'

export default async function CashCloseHistoryPage() {
    const insforge = createServerClient()

    // 1. Consultar historial de turnos (CashShift)
    const { data: shiftsData } = await insforge.database
        .from('CashShift')
        .select('*')
        .order('openedAt', { ascending: false })
        .limit(50)

    const shifts = (shiftsData || []) as CashShiftRecord[]

    // Cálculos globales
    const closedShifts = shifts.filter(s => s.status === 'CLOSED')
    const totalCollectedAll = closedShifts.reduce((sum, s) => sum + Number(s.totalCollected || 0), 0)
    const totalExpensesAll = closedShifts.reduce((sum, s) => sum + Number(s.totalExpenses || 0), 0)
    const totalBilledAll = closedShifts.reduce((sum, s) => sum + Number(s.totalBilled || 0), 0)

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <div className="flex flex-col space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Historial de Turnos de Caja</h2>
                <p className="text-muted-foreground">
                    Registro histórico y auditoría de todos los ciclos de caja abiertos y cerrados.
                </p>
            </div>

            {/* Tarjetas de Resumen Global */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Facturado (Turnos Cerrados)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalBilledAll)}</div>
                        <p className="text-xs text-muted-foreground">{closedShifts.length} turnos completados</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-green-700">Total Cobrado (Turnos Cerrados)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">{formatCurrency(totalCollectedAll)}</div>
                        <p className="text-xs text-muted-foreground">Ingresos totales ingresados a caja</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-600">Total Gastos (Turnos Cerrados)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">-{formatCurrency(totalExpensesAll)}</div>
                        <p className="text-xs text-muted-foreground">Salidas autorizadas de caja</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla de Turnos */}
            <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Listado de Turnos / Ciclos</h3>
                    <Badge variant="outline">{shifts.length} registros</Badge>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Turno #</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Apertura</TableHead>
                            <TableHead>Cierre</TableHead>
                            <TableHead>Cajero</TableHead>
                            <TableHead className="text-right">Fondo</TableHead>
                            <TableHead className="text-right">Cobrado</TableHead>
                            <TableHead className="text-right">Gastos</TableHead>
                            <TableHead className="text-right">Arqueo Físico</TableHead>
                            <TableHead className="text-center">Cuadre</TableHead>
                            <TableHead className="text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shifts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                                    No hay turnos registrados aún.
                                </TableCell>
                            </TableRow>
                        ) : (
                            shifts.map((s) => {
                                const isClosed = s.status === 'CLOSED'
                                const disc = Number(s.discrepancy || 0)

                                return (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-mono font-bold">
                                            Turno #{s.shiftNumber}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={isClosed ? "bg-gray-100 text-gray-800 border-gray-300" : "bg-emerald-600 text-white"}>
                                                {isClosed ? "Cerrado" : "En Curso"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {format(new Date(s.openedAt), "dd/MM/yyyy HH:mm", { locale: es })}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {s.closedAt ? format(new Date(s.closedAt), "dd/MM/yyyy HH:mm", { locale: es }) : "-"}
                                        </TableCell>
                                        <TableCell className="text-xs font-medium">
                                            {s.openedByName || "Usuario"}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs">
                                            {formatCurrency(Number(s.openingBalance))}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-green-700 font-semibold">
                                            +{formatCurrency(Number(s.totalCollected))}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-red-600">
                                            -{formatCurrency(Number(s.totalExpenses))}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs font-bold">
                                            {isClosed ? formatCurrency(Number(s.actualCash)) : "Pendiente"}
                                        </TableCell>
                                        <TableCell className="text-center text-xs">
                                            {!isClosed ? (
                                                <span className="text-muted-foreground">-</span>
                                            ) : disc === 0 ? (
                                                <span className="text-green-700 font-bold">✓ Cuadrado</span>
                                            ) : disc < 0 ? (
                                                <span className="text-red-600 font-bold">Faltante {formatCurrency(Math.abs(disc))}</span>
                                            ) : (
                                                <span className="text-yellow-600 font-bold">Sobrante {formatCurrency(disc)}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <ShiftDetailDialog shift={s} />
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
