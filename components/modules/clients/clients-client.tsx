"use client"

import { useMemo, useState } from "react"
import { ClientDialog } from "@/components/modules/clients/client-dialog"
import { DeleteClientDialog } from "@/components/modules/clients/delete-client-dialog"
import { ClientHistoryDialog } from "@/components/modules/clients/client-history-dialog"
import { ClientFilters } from "@/components/modules/clients/client-filters"
import { ClientReportPrint } from "@/components/modules/reports/client-report-print"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import type { Client } from "@/types"

interface ClientsClientProps {
    initialClients: Client[]
}

interface ClientFiltersState {
    name?: string
    rnc?: string
    startDate?: string
    endDate?: string
}

export function ClientsClient({ initialClients }: ClientsClientProps) {
    const [filters, setFilters] = useState<ClientFiltersState>({})
    const [showPrint, setShowPrint] = useState(false)

    const visibleClients = useMemo(() => {
        const normalizedName = filters.name?.trim().toLowerCase()
        const normalizedRnc = filters.rnc?.trim().toLowerCase()
        const startDate = filters.startDate ? new Date(filters.startDate) : null
        const endDate = filters.endDate ? new Date(filters.endDate) : null

        if (endDate) {
            endDate.setHours(23, 59, 59, 999)
        }

        return initialClients.filter((client) => {
            const createdAt = new Date(client.createdAt)

            if (normalizedName && !client.name.toLowerCase().includes(normalizedName)) {
                return false
            }

            if (normalizedRnc && !client.rnc?.toLowerCase().includes(normalizedRnc)) {
                return false
            }

            if (startDate && createdAt < startDate) {
                return false
            }

            if (endDate && createdAt > endDate) {
                return false
            }

            return true
        })
    }, [filters, initialClients])

    const handleFilter = (filters: ClientFiltersState) => {
        setFilters(filters)
    }

    const handlePrint = () => {
        setShowPrint(true)
        setTimeout(() => {
            window.print()
            setShowPrint(false)
        }, 100)
    }

    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
                    <div className="flex items-center space-x-2">
                        <ClientFilters onFilter={handleFilter} onPrint={handlePrint} />
                        <ClientDialog />
                    </div>
                </div>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>RNC</TableHead>
                                <TableHead>Cédula</TableHead>
                                <TableHead>Teléfono</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Dirección</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleClients.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center">
                                        No hay clientes registrados.
                                    </TableCell>
                                </TableRow>
                            )}
                            {visibleClients.map((client) => (
                                <TableRow key={client.id}>
                                    <TableCell className="font-medium">{client.name}</TableCell>
                                    <TableCell>{client.rnc || "-"}</TableCell>
                                    <TableCell>{client.cedula || "-"}</TableCell>
                                    <TableCell>{client.phone}</TableCell>
                                    <TableCell>{client.email}</TableCell>
                                    <TableCell>{client.address}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <ClientHistoryDialog client={client} />
                                            <ClientDialog client={client} />
                                            <DeleteClientDialog clientId={client.id} clientName={client.name} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {showPrint && (
                <div className="fixed inset-0 z-50 bg-white overflow-auto">
                    <ClientReportPrint clients={visibleClients} />
                </div>
            )}
        </>
    )
}
