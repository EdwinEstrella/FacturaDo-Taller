"use client"

import { useState, useEffect } from "react"
import { getClients } from "@/actions/client-actions"
import { filterClients } from "@/actions/filter-actions"
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
import type { Client } from "@prisma/client"
import TetrisLoading from "@/components/ui/tetris-loader"

export default function ClientsPage() {
    const [filteredClients, setFilteredClients] = useState<Client[]>([])
    const [showPrint, setShowPrint] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadClients = async () => {
            setLoading(true)
            const data = await getClients()
            setFilteredClients(data)
            setLoading(false)
        }
        loadClients()
    }, [])

    const handleFilter = async (filters: {
        name?: string
        rnc?: string
        startDate?: string
        endDate?: string
    }) => {
        const filtered = await filterClients({
            name: filters.name,
            rnc: filters.rnc,
            startDate: filters.startDate ? new Date(filters.startDate) : undefined,
            endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        })
        setFilteredClients(filtered)
    }

    const handlePrint = () => {
        setShowPrint(true)
        setTimeout(() => {
            window.print()
            setShowPrint(false)
        }, 100)
    }

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center min-h-[50vh]">
                <TetrisLoading size="md" speed="normal" loadingText="Cargando..." />
            </div>
        )
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
                                <TableHead>RNC/Cédula</TableHead>
                                <TableHead>Teléfono</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Dirección</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredClients.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center">
                                        No hay clientes registrados.
                                    </TableCell>
                                </TableRow>
                            )}
                            {filteredClients.map((client) => (
                                <TableRow key={client.id}>
                                    <TableCell className="font-medium">{client.name}</TableCell>
                                    <TableCell>{client.rnc}</TableCell>
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
                    <ClientReportPrint clients={filteredClients} />
                </div>
            )}
        </>
    )
}
