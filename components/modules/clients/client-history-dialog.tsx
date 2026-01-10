"use client"

import { useState } from "react"
import { Clock, FileText, UserPlus, Edit, Printer, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { getClientHistory } from "@/actions/client-history-actions"
import { getClientStats } from "@/actions/client-history-actions"
import type { Client } from "@prisma/client"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"

interface ClientHistoryDialogProps {
    client: Client
}

const actionIcons = {
    CREATED: UserPlus,
    UPDATED: Edit,
    INVOICE_CREATED: FileText,
    INVOICE_PAID: FileText,
    QUOTE_CREATED: FileText,
}

const actionColors = {
    CREATED: "text-green-600",
    UPDATED: "text-blue-600",
    INVOICE_CREATED: "text-purple-600",
    INVOICE_PAID: "text-emerald-600",
    QUOTE_CREATED: "text-orange-600",
}

const actionLabels = {
    CREATED: "Cliente creado",
    UPDATED: "Cliente actualizado",
    INVOICE_CREATED: "Factura creada",
    INVOICE_PAID: "Factura pagada",
    QUOTE_CREATED: "Cotización creada",
}

export function ClientHistoryDialog({ client }: ClientHistoryDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [history, setHistory] = useState<
        Array<{
            id: string
            action: string
            description: string | null
            metadata: string | null
            createdAt: Date
        }>
    >([])
    const [stats, setStats] = useState<{
        invoiceCount: number
        totalSpent: number
        lastActivityDate: Date | null
    } | null>(null)

    const loadHistory = async () => {
        setLoading(true)
        try {
            const [historyData, statsData] = await Promise.all([
                getClientHistory(client.id),
                getClientStats(client.id),
            ])

            if (historyData.success && historyData.data) {
                setHistory(historyData.data)
            }

            if (statsData.success && statsData.data) {
                setStats({
                    ...statsData.data,
                    lastActivityDate: statsData.data.lastActivityDate || null,
                })
            }
        } catch {
            console.error("Error loading client history")
        } finally {
            setLoading(false)
        }
    }

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
        if (newOpen && history.length === 0) {
            loadHistory()
        }
    }

    const Icon = Clock

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Ver historial">
                    <Clock className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Historial de {client.name}
                    </DialogTitle>
                    <DialogDescription>
                        Registro de todas las actividades y transacciones del cliente
                    </DialogDescription>
                </DialogHeader>

                {stats && (
                    <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">{stats.invoiceCount}</p>
                            <p className="text-xs text-gray-600">Facturas totales</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">
                                ${stats.totalSpent.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-600">Total gastado</p>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-gray-700">
                                {stats.lastActivityDate
                                    ? format(new Date(stats.lastActivityDate), "dd/MM/yyyy HH:mm", { locale: es })
                                    : "Sin actividad"}
                            </p>
                            <p className="text-xs text-gray-600">Última actividad</p>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        No hay historial disponible para este cliente
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Acción</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Detalles</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history.map((entry) => {
                                const ActionIcon = actionIcons[entry.action as keyof typeof actionIcons] || Edit
                                const colorClass = actionColors[entry.action as keyof typeof actionColors] || "text-gray-600"
                                const label = actionLabels[entry.action as keyof typeof actionLabels] || entry.action

                                return (
                                    <TableRow key={entry.id}>
                                        <TableCell className="whitespace-nowrap">
                                            {format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                                        </TableCell>
                                        <TableCell>
                                            <div className={`flex items-center gap-2 ${colorClass}`}>
                                                <ActionIcon className="h-4 w-4" />
                                                <span className="font-medium">{label}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{entry.description || "-"}</TableCell>
                                        <TableCell>
                                            {entry.metadata && (
                                                <div className="flex gap-2">
                                                    {(() => {
                                                        try {
                                                            const metadata = JSON.parse(entry.metadata)
                                                            if (metadata.invoiceId) {
                                                                return (
                                                                    <>
                                                                        <Link
                                                                            href={`/invoices/${metadata.invoiceId}/print`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                        >
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                        className="h-7 text-xs"
                                                                            >
                                                                                <Printer className="h-3 w-3 mr-1" />
                                                                                Imprimir
                                                                            </Button>
                                                                        </Link>
                                                                        <Link href={`/invoices/${metadata.invoiceId}/edit`}>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-7 text-xs"
                                                                            >
                                                                                <ExternalLink className="h-3 w-3 mr-1" />
                                                                                Ver Factura
                                                                            </Button>
                                                                        </Link>
                                                                    </>
                                                                )
                                                            }
                                                            return (
                                                                <details className="text-xs text-gray-500">
                                                                    <summary className="cursor-pointer hover:text-gray-700">
                                                                        Ver detalles
                                                                    </summary>
                                                                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                                                                        {JSON.stringify(metadata, null, 2)}
                                                                    </pre>
                                                                </details>
                                                            )
                                                        } catch {
                                                            return null
                                                        }
                                                    })()}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                )}
            </DialogContent>
        </Dialog>
    )
}
