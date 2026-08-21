"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Printer, X } from "lucide-react"

interface ClientFiltersProps {
    onFilter: (filters: {
        name?: string
        rnc?: string
        startDate?: string
        endDate?: string
    }) => void
    onPrint: () => void
}

export function ClientFilters({ onFilter, onPrint }: ClientFiltersProps) {
    const [name, setName] = useState("")
    const [rnc, setRnc] = useState("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    const handleApply = () => {
        onFilter({
            name: name || undefined,
            rnc: rnc || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
        })
    }

    const handleClear = () => {
        setName("")
        setRnc("")
        setStartDate("")
        setEndDate("")
        onFilter({})
    }

    const hasActiveFilters = Boolean(name || rnc || startDate || endDate)

    return (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
            <Input
                aria-label="Buscar cliente por nombre"
                className="h-9 w-56"
                placeholder="Buscar por nombre..."
                value={name}
                onChange={(event) => setName(event.target.value)}
            />
            <Input
                aria-label="Buscar cliente por RNC o cédula"
                className="h-9 w-48"
                placeholder="RNC o cédula..."
                value={rnc}
                onChange={(event) => setRnc(event.target.value)}
            />
            <Input
                aria-label="Clientes creados desde"
                className="h-9 w-[145px]"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
            />
            <Input
                aria-label="Clientes creados hasta"
                className="h-9 w-[145px]"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
            />
            <Button className="h-9" size="sm" onClick={handleApply}>Aplicar</Button>
            {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-9" onClick={handleClear} title="Limpiar filtros" aria-label="Limpiar filtros">
                    <X className="mr-1 h-4 w-4" />
                    Limpiar
                </Button>
            )}
            <Button variant="outline" size="sm" className="h-9" onClick={onPrint}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
            </Button>
        </div>
    )
}
