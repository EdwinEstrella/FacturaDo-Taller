"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Filter, Printer } from "lucide-react"

interface InvoiceFiltersProps {
    onFilter: (filters: {
        startDate?: string
        endDate?: string
        minAmount?: string
        maxAmount?: string
        period?: string
    }) => void
    onPrint: () => void
}

export function InvoiceFilters({ onFilter, onPrint }: InvoiceFiltersProps) {
    const [open, setOpen] = useState(false)
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [minAmount, setMinAmount] = useState("")
    const [maxAmount, setMaxAmount] = useState("")
    const [period, setPeriod] = useState("")

    const handleApply = () => {
        onFilter({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            minAmount: minAmount || undefined,
            maxAmount: maxAmount || undefined,
            period: period || undefined,
        })
        setOpen(false)
    }

    const handleClear = () => {
        setStartDate("")
        setEndDate("")
        setMinAmount("")
        setMaxAmount("")
        setPeriod("")
        onFilter({})
        setOpen(false)
    }

    const handlePeriodChange = (value: string) => {
        setPeriod(value)
        // Si selecciona un periodo, limpiar las fechas manuales
        if (value) {
            setStartDate("")
            setEndDate("")
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <div className="flex gap-2">
                <DialogTrigger asChild>
                    <Button variant="outline">
                        <Filter className="h-4 w-4 mr-2" />
                        Filtros
                    </Button>
                </DialogTrigger>
                <Button variant="outline" onClick={onPrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Reporte
                </Button>
            </div>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Filtrar Facturas</DialogTitle>
                    <DialogDescription>
                        Aplica filtros para buscar facturas específicas
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Periodo</Label>
                        <Select value={period} onValueChange={handlePeriodChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un periodo..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="today">Hoy</SelectItem>
                                <SelectItem value="week">Esta Semana</SelectItem>
                                <SelectItem value="month">Este Mes</SelectItem>
                                <SelectItem value="year">Este Año</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Rango de Fechas</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="startDate" className="text-xs">Desde</Label>
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value)
                                        setPeriod("")
                                    }}
                                    disabled={!!period}
                                />
                            </div>
                            <div>
                                <Label htmlFor="endDate" className="text-xs">Hasta</Label>
                                <Input
                                    id="endDate"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value)
                                        setPeriod("")
                                    }}
                                    disabled={!!period}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Rango de Montos</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="minAmount" className="text-xs">Mínimo</Label>
                                <Input
                                    id="minAmount"
                                    type="number"
                                    placeholder="0.00"
                                    value={minAmount}
                                    onChange={(e) => setMinAmount(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="maxAmount" className="text-xs">Máximo</Label>
                                <Input
                                    id="maxAmount"
                                    type="number"
                                    placeholder="0.00"
                                    value={maxAmount}
                                    onChange={(e) => setMaxAmount(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleClear}>
                        Limpiar
                    </Button>
                    <Button onClick={handleApply}>
                        Aplicar Filtros
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
