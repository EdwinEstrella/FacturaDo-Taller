"use client"

import { useState, useEffect } from "react"
import { prisma } from "@/lib/prisma"
import { markAsDispatched } from "@/actions/invoice-actions"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Truck, Printer } from "lucide-react"
import { DispatchReportPrint } from "@/components/modules/reports/dispatch-report-print"

export default function DispatchPage() {
    const [invoices, setInvoices] = useState([])
    const [dispatches, setDispatches] = useState([])
    const [showPrint, setShowPrint] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            // Fetch pending invoices
            const res = await fetch('/api/dispatches/pending')
            const data = await res.json()
            setInvoices(data.invoices || [])
            setDispatches(data.dispatches || [])
        } catch {
            // Fallback: empty arrays
            setInvoices([])
            setDispatches([])
        } finally {
            setLoading(false)
        }
    }

    const handlePrint = () => {
        setShowPrint(true)
        setTimeout(() => {
            window.print()
            setShowPrint(false)
        }, 100)
    }

    if (loading) {
        return <div className="p-8">Cargando...</div>
    }

    const allDispatches = [...dispatches, ...invoices.filter((inv: any) => !inv.dispatched).map((inv: any) => ({
        id: inv.id,
        invoice: inv,
        status: 'PENDING',
        createdAt: inv.createdAt
    }))]

    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Despacho / Conduce</h2>
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir Reporte
                    </Button>
                </div>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Estado</TableHead>
                                <TableHead>Factura</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Dirección</TableHead>
                                <TableHead>Técnico</TableHead>
                                <TableHead className="text-right">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allDispatches.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center">
                                        No hay despachos pendientes
                                    </TableCell>
                                </TableRow>
                            )}
                            {allDispatches.map((dispatch: any) => {
                                const invoice = dispatch.invoice || dispatch
                                const client = invoice.client
                                const status: string = dispatch.status || 'PENDING'
                                const statusColors: Record<string, string> = {
                                    'PENDING': 'bg-yellow-100 text-yellow-800',
                                    'ASSIGNED': 'bg-blue-100 text-blue-800',
                                    'IN_PROGRESS': 'bg-purple-100 text-purple-800',
                                    'DELIVERED': 'bg-green-100 text-green-800',
                                    'INSTALLED': 'bg-emerald-100 text-emerald-800'
                                }
                                const statusLabels: Record<string, string> = {
                                    'PENDING': 'Pendiente',
                                    'ASSIGNED': 'Asignado',
                                    'IN_PROGRESS': 'En Progreso',
                                    'DELIVERED': 'Entregado',
                                    'INSTALLED': 'Instalado'
                                }

                                return (
                                    <TableRow key={dispatch.id}>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[status] || 'bg-gray-100'}`}>
                                                {statusLabels[status] || status}
                                            </span>
                                        </TableCell>
                                        <TableCell>#{invoice.sequenceNumber}</TableCell>
                                        <TableCell>{invoice.clientName || client?.name}</TableCell>
                                        <TableCell>{client?.address || "N/A"}</TableCell>
                                        <TableCell>{dispatch.technician?.name || "-"}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={async () => {
                                                    await markAsDispatched(invoice.id)
                                                    window.location.reload()
                                                }}
                                            >
                                                <Truck className="mr-2 h-4 w-4" /> Despachar
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {showPrint && (
                <div className="fixed inset-0 z-50 bg-white overflow-auto">
                    <DispatchReportPrint dispatches={allDispatches} />
                </div>
            )}
        </>
    )
}
