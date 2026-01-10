"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Filter, Printer } from "lucide-react"

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
    const [open, setOpen] = useState(false)
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
        setOpen(false)
    }

    const handleClear = () => {
        setName("")
        setRnc("")
        setStartDate("")
        setEndDate("")
        onFilter({})
        setOpen(false)
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
                    Imprimir Lista
                </Button>
            </div>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Filtrar Clientes</DialogTitle>
                    <DialogDescription>
                        Aplica filtros para buscar clientes específicos
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input
                            id="name"
                            placeholder="Buscar por nombre..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="rnc">RNC/Cédula</Label>
                        <Input
                            id="rnc"
                            placeholder="Buscar por RNC..."
                            value={rnc}
                            onChange={(e) => setRnc(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Desde</Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">Hasta</Label>
                            <Input
                                id="endDate"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
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
