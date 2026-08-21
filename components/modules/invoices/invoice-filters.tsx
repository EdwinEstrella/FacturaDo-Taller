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
    const [period, setPeriod] = useState("")
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <span className="text-sm font-medium">Período:</span>
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

            <span className="ml-2 text-sm font-medium">Estado:</span>
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

            <div className="flex flex-wrap items-center gap-2 border-l pl-2">
                <Input
                    aria-label="Fecha desde"
                    className="h-8 w-[145px]"
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                        setStartDate(event.target.value)
                        setPeriod("")
                    }}
                />
                <Input
                    aria-label="Fecha hasta"
                    className="h-8 w-[145px]"
                    type="date"
                    value={endDate}
                    onChange={(event) => {
                        setEndDate(event.target.value)
                        setPeriod("")
                    }}
                />
                <Input
                    aria-label="Monto mínimo"
                    className="h-8 w-24"
                    type="number"
                    placeholder="Mínimo"
                    value={minAmount}
                    onChange={(event) => setMinAmount(event.target.value)}
                />
                <Input
                    aria-label="Monto máximo"
                    className="h-8 w-24"
                    type="number"
                    placeholder="Máximo"
                    value={maxAmount}
                    onChange={(event) => setMaxAmount(event.target.value)}
                />
                <Button size="sm" onClick={handleApply}>Aplicar</Button>
            </div>
            {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={handleClear} title="Limpiar filtros" aria-label="Limpiar filtros">
                    <X className="h-4 w-4" />
                </Button>
            )}
            <Button variant="outline" size="sm" onClick={onPrint}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
            </Button>
        </div>
    )
}
