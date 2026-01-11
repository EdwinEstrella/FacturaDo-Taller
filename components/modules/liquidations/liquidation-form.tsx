"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Loader2, Printer } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { formatDateTimeDO } from "@/lib/date-utils"
import { getLiquidationData } from "@/actions/liquidation-actions"
import { toast } from "sonner"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface User {
    id: string
    name: string
    role: string
}

import { DateRange } from "react-day-picker"

interface LiquidationInvoice {
    id: string
    createdAt: Date
    sequenceNumber: number
    clientName: string | null
    status: string
    total: number
}

interface LiquidationResult {
    user: { name: string }
    summary: {
        totalSales: number
        totalPaid: number
        initialPending: number
    }
    invoices: LiquidationInvoice[]
}

interface LiquidationFormProps {
    users: User[]
}

export default function LiquidationForm({ users }: LiquidationFormProps) {
    const [selectedUserId, setSelectedUserId] = useState("")
    const [date, setDate] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    })
    const [commissionRate, setCommissionRate] = useState<number>(0) // Percentage

    // Results
    const [results, setResults] = useState<LiquidationResult | null>(null)
    const [isPending, startTransition] = useTransition()

    const handleGenerate = () => {
        if (!selectedUserId) return toast.error("Seleccione un usuario")
        if (!date?.from || !date?.to) return toast.error("Seleccione un rango de fechas")

        startTransition(async () => {
            const res = await getLiquidationData({
                userId: selectedUserId,
                startDate: date.from!,
                endDate: date.to!
            })

            if (res.success) {
                setResults(res.data as LiquidationResult)
            } else {
                toast.error("Error: " + res.error)
            }
        })
    }

    const commissionAmount = results ? (results.summary.totalSales * (commissionRate / 100)) : 0

    return (
        <div className="space-y-6">
            <Card className="print:hidden">
                <CardHeader>
                    <CardTitle>Generar Liquidación / Reporte de Comisiones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Usuario / Vendedor</label>
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map(u => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.name} ({u.role})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Rango de Fechas</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date?.from ? (
                                            date.to ? (
                                                <>
                                                    {format(date.from, "LDL", { locale: es })} -{" "}
                                                    {format(date.to, "LDL", { locale: es })}
                                                </>
                                            ) : (
                                                format(date.from, "LDL", { locale: es })
                                            )
                                        ) : (
                                            <span>Seleccionar fechas</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={date?.from}
                                        selected={date}
                                        onSelect={setDate}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">% Comisión (Opcional)</label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={commissionRate}
                                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                                    className="pr-6"
                                />
                                <span className="absolute right-3 top-2.5 text-sm text-gray-500">%</span>
                            </div>
                        </div>
                    </div>

                    <Button onClick={handleGenerate} disabled={isPending} className="w-full md:w-auto">
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generar Reporte
                    </Button>
                </CardContent>
            </Card>

            {results && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <Card className="print:shadow-none print:border-none">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Reporte de Liquidación</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {results.user.name} | {format(date!.from!, "dd/MM/yyyy")} - {format(date!.to!, "dd/MM/yyyy")}
                                </p>
                            </div>
                            <Button variant="outline" size="icon" onClick={() => window.print()} className="print:hidden">
                                <Printer className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <p className="text-sm text-gray-500">Total Ventas</p>
                                    <p className="text-2xl font-bold">{formatCurrency(results.summary.totalSales)}</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg">
                                    <p className="text-sm text-green-700">Comisión ({commissionRate}%)</p>
                                    <p className="text-2xl font-bold text-green-700">{formatCurrency(commissionAmount)}</p>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <p className="text-sm text-blue-700">Pagado</p>
                                    <p className="text-2xl font-bold text-blue-700">{formatCurrency(results.summary.totalPaid)}</p>
                                </div>
                                <div className="bg-orange-50 p-4 rounded-lg">
                                    <p className="text-sm text-orange-700">Pendiente (Crédito)</p>
                                    <p className="text-2xl font-bold text-orange-700">{formatCurrency(results.summary.initialPending)}</p>
                                </div>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Factura</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {results.invoices.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center">No se encontraron ventas</TableCell>
                                            </TableRow>
                                        )}
                                        {results.invoices.map((inv) => (
                                            <TableRow key={inv.id}>
                                                <TableCell>{formatDateTimeDO(inv.createdAt)}</TableCell>
                                                <TableCell>#{inv.sequenceNumber}</TableCell>
                                                <TableCell>{inv.clientName || "Consumidor Final"}</TableCell>
                                                <TableCell>{inv.status}</TableCell>
                                                <TableCell className="text-right font-mono">{formatCurrency(inv.total)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
