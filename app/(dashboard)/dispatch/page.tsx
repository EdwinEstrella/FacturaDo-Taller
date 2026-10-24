"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
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
import { Clock, Loader2, PackageCheck, Printer, Truck, UserCheck } from "lucide-react"
import { DispatchReportPrint } from "@/components/modules/reports/dispatch-report-print"
import { PageLoading } from "@/components/ui/loading"
import {
    ClientCell,
    EmptyList,
    PageHeader,
    SearchInput,
    SegmentedControl,
    StatTile,
    StatusPill,
    type PillTone,
} from "@/components/modules/shared/list-page"
import { formatDateDO } from "@/lib/date-utils"

interface Invoice {
    id: string
    sequenceNumber?: number
    clientName?: string | null
    client?: {
        name?: string
        address?: string
    } | null
    dispatched: boolean
    createdAt: Date | string
}

interface Dispatch {
    id: string
    invoiceId?: string
    invoice?: Invoice | null
    status?: string
    technician?: {
        name?: string
    } | null
    createdAt: Date | string
}

type StatusFilter = "ALL" | "PENDING" | "ASSIGNED" | "IN_PROGRESS"

const STATUS: Record<string, { label: string; tone: PillTone }> = {
    PENDING: { label: "Por despachar", tone: "amber" },
    ASSIGNED: { label: "Asignado", tone: "blue" },
    IN_PROGRESS: { label: "En camino", tone: "blue" },
    DELIVERED: { label: "Entregado", tone: "green" },
    INSTALLED: { label: "Instalado", tone: "green" },
}

export default function DispatchPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [dispatches, setDispatches] = useState<Dispatch[]>([])
    const [showPrint, setShowPrint] = useState(false)
    const [loading, setLoading] = useState(true)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [status, setStatus] = useState<StatusFilter>("ALL")
    const [query, setQuery] = useState("")

    const loadData = useCallback(async () => {
        try {
            const res = await fetch('/api/dispatches/pending', { cache: 'no-store' })
            const data = await res.json()
            setInvoices(data.invoices || [])
            setDispatches(data.dispatches || [])
        } catch {
            setInvoices([])
            setDispatches([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadData()
    }, [loadData])

    const handlePrint = () => {
        setShowPrint(true)
        setTimeout(() => {
            window.print()
            setShowPrint(false)
        }, 100)
    }

    const allDispatches: Dispatch[] = useMemo(() => {
        // Una factura que ya tiene un despacho en curso no se repite como "por despachar".
        const withDispatch = new Set(dispatches.map((d) => d.invoiceId || d.invoice?.id).filter(Boolean))
        return [
            ...invoices
                .filter((inv) => !inv.dispatched && !withDispatch.has(inv.id))
                .map((inv) => ({ id: inv.id, invoice: inv, status: 'PENDING', createdAt: inv.createdAt })),
            ...dispatches,
        ]
    }, [invoices, dispatches])

    const counts = useMemo(() => ({
        ALL: allDispatches.length,
        PENDING: allDispatches.filter((d) => (d.status || 'PENDING') === 'PENDING').length,
        ASSIGNED: allDispatches.filter((d) => d.status === 'ASSIGNED').length,
        IN_PROGRESS: allDispatches.filter((d) => d.status === 'IN_PROGRESS').length,
    }), [allDispatches])

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase()
        return allDispatches.filter((d) => {
            if (status !== "ALL" && (d.status || 'PENDING') !== status) return false
            if (!q) return true
            const inv = d.invoice
            const text = `${inv?.sequenceNumber ?? ""} ${inv?.clientName || inv?.client?.name || ""} ${inv?.client?.address || ""} ${d.technician?.name || ""}`.toLowerCase()
            return text.includes(q)
        })
    }, [allDispatches, status, query])

    const dispatchNow = async (invoiceId: string) => {
        setBusyId(invoiceId)
        try {
            await markAsDispatched(invoiceId)
            toast.success("Factura despachada")
            await loadData()
        } catch {
            toast.error("No se pudo despachar la factura")
        } finally {
            setBusyId(null)
        }
    }

    if (loading) {
        return <PageLoading message="Cargando despachos..." />
    }

    return (
        <>
            <div className="flex-1 space-y-6">
                <PageHeader
                    title="Despacho"
                    description="Facturas pagadas listas para entregar y entregas en curso."
                    actions={
                        <Button variant="outline" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" />
                            Reporte
                        </Button>
                    }
                />

                <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                    <StatTile label="Por despachar" value={counts.PENDING} hint="Facturas pagadas sin entregar" icon={<Clock />} tone="amber" />
                    <StatTile label="Asignados" value={counts.ASSIGNED} hint="Con técnico asignado" icon={<UserCheck />} tone="blue" />
                    <StatTile label="En camino" value={counts.IN_PROGRESS} hint="Entregas en curso" icon={<Truck />} tone="green" />
                </div>

                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
                        <SearchInput
                            value={query}
                            onChange={setQuery}
                            placeholder="Buscar por factura, cliente, dirección o técnico..."
                            className="lg:max-w-md lg:flex-1"
                        />
                        <SegmentedControl
                            options={[
                                { value: "ALL" as StatusFilter, label: "Todos", count: counts.ALL },
                                { value: "PENDING" as StatusFilter, label: "Por despachar", count: counts.PENDING },
                                { value: "ASSIGNED" as StatusFilter, label: "Asignados", count: counts.ASSIGNED },
                                { value: "IN_PROGRESS" as StatusFilter, label: "En camino", count: counts.IN_PROGRESS },
                            ]}
                            value={status}
                            onChange={setStatus}
                        />
                    </div>

                    {visible.length === 0 ? (
                        <EmptyList
                            icon={<PackageCheck />}
                            title={query ? "Sin resultados" : "Todo despachado"}
                            description={query ? "Probá con otro número, cliente o dirección." : "No hay entregas pendientes en este momento."}
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                    <TableHead className="pl-4">Factura</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Técnico</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="pr-4 text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visible.map((dispatch) => {
                                    const invoice = dispatch.invoice
                                    const st = STATUS[dispatch.status || 'PENDING'] || { label: dispatch.status || "", tone: "slate" as PillTone }
                                    const pending = (dispatch.status || 'PENDING') === 'PENDING'
                                    return (
                                        <TableRow key={`${dispatch.status}-${dispatch.id}`}>
                                            <TableCell className="py-3 pl-4">
                                                <p className="font-mono font-semibold text-blue-700">
                                                    #{String(invoice?.sequenceNumber ?? "").padStart(6, "0")}
                                                </p>
                                                <p className="text-xs text-muted-foreground">{invoice ? formatDateDO(invoice.createdAt) : "—"}</p>
                                            </TableCell>
                                            <TableCell className="max-w-[340px] py-3">
                                                <ClientCell
                                                    name={invoice?.clientName || invoice?.client?.name || "Consumidor Final"}
                                                    detail={invoice?.client?.address || "Sin dirección registrada"}
                                                />
                                            </TableCell>
                                            <TableCell className="py-3 text-sm text-slate-600">{dispatch.technician?.name || "—"}</TableCell>
                                            <TableCell className="py-3">
                                                <StatusPill tone={st.tone}>{st.label}</StatusPill>
                                            </TableCell>
                                            <TableCell className="py-3 pr-4 text-right">
                                                {pending && invoice?.id && (
                                                    <Button size="sm" onClick={() => dispatchNow(invoice.id)} disabled={busyId === invoice.id}>
                                                        {busyId === invoice.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                                                        Despachar
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>

            {showPrint && (
                <div className="fixed inset-0 z-50 bg-white overflow-auto">
                    <DispatchReportPrint dispatches={visible} />
                </div>
            )}
        </>
    )
}
