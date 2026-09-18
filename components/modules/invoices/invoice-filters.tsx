"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Printer, X } from "lucide-react"

interface InvoiceFiltersProps {
    onFilter: (filters: {
        startDate?: string
        endDate?: string
        minAmount?: string
        maxAmount?: string
        period?: string
        status?: 'PAID' | 'PENDING' | 'CANCELLED'
    }) => void
    onPrint: () => void
}

export function InvoiceFilters({ onFilter, onPrint }: InvoiceFiltersProps) {
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [minAmount, setMinAmount] = useState("")
    const [maxAmount, setMaxAmount] = useState("")
    // Default to the current month so the initial view stays light and matches the page's initial load.
    const [period, setPeriod] = useState("month")
    const [status, setStatus] = useState("ALL")

    const handleApply = () => {
        onFilter({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            minAmount: minAmount || undefined,
            maxAmount: maxAmount || undefined,
            period: period || undefined,
            status: status === "ALL" ? undefined : status as 'PAID' | 'PENDING' | 'CANCELLED',
        })
    }

    const handleClear = () => {
        setStartDate("")
        setEndDate("")
        setMinAmount("")
        setMaxAmount("")
        setPeriod("")
        setStatus("ALL")
        onFilter({})
    }

    const handlePeriodChange = (value: string) => {
        setPeriod(value)
        setStartDate("")
        setEndDate("")
        onFilter({
            minAmount: minAmount || undefined,
            maxAmount: maxAmount || undefined,
            period: value,
            status: status === "ALL" ? undefined : status as 'PAID' | 'PENDING' | 'CANCELLED',
        })
    }

    const handleStatusChange = (value: string) => {
        setStatus(value)
        onFilter({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            minAmount: minAmount || undefined,
            maxAmount: maxAmount || undefined,
            period: period || undefined,
            status: value === "ALL" ? undefined : value as 'PAID' | 'PENDING' | 'CANCELLED',
        })
    }

    const hasActiveFilters = Boolean(startDate || endDate || minAmount || maxAmount || period || status !== "ALL")

    return (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">Período</span>
                    {[
                        ["today", "Hoy"],
                        ["week", "Semana"],
                        ["month", "Mes"],
                        ["year", "Año"],
                    ].map(([value, label]) => (
                        <Button
                            key={value}
                            variant={period === value ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePeriodChange(value)}
                        >
                            {label}
                        </Button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">Estado</span>
                    {[
                        ["PENDING", "Pendientes"],
                        ["PAID", "Pagadas"],
                        ["CANCELLED", "Canceladas"],
                    ].map(([value, label]) => (
                        <Button
                            key={value}
                            variant={status === value ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleStatusChange(status === value ? "ALL" : value)}
                        >
                            {label}
                        </Button>
                    ))}
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={handleClear} title="Limpiar filtros" aria-label="Limpiar filtros">
                            <X className="mr-1 h-4 w-4" />
                            Limpiar
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={onPrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 border-t pt-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="grid grid-cols-2 gap-2">
                    <Input
                        aria-label="Fecha desde"
                        className="h-9"
                        type="date"
                        value={startDate}
                        onChange={(event) => {
                            setStartDate(event.target.value)
                            setPeriod("")
                        }}
                    />
                    <Input
                        aria-label="Fecha hasta"
                        className="h-9"
                        type="date"
                        value={endDate}
                        onChange={(event) => {
                            setEndDate(event.target.value)
                            setPeriod("")
                        }}
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Input
                        aria-label="Monto mínimo"
                        className="h-9"
                        type="number"
                        placeholder="Monto mínimo"
                        value={minAmount}
                        onChange={(event) => setMinAmount(event.target.value)}
                    />
                    <Input
                        aria-label="Monto máximo"
                        className="h-9"
                        type="number"
                        placeholder="Monto máximo"
                        value={maxAmount}
                        onChange={(event) => setMaxAmount(event.target.value)}
                    />
                </div>
                <Button className="h-9" onClick={handleApply}>Aplicar filtros</Button>
            </div>
        </div>
    )
}
