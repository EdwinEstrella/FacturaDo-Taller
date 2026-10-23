"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { filterInvoices } from "@/actions/filter-actions"
import { getCurrentUser } from "@/actions/auth-actions"
import { getCompanySettings, type CompanySettings } from "@/actions/settings-actions"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InvoiceReportPrint } from "@/components/modules/reports/invoice-report-print"
import { InvoicePreviewDialog } from "@/components/modules/invoices/invoice-preview"
import { DispatchSlipPreviewDialog } from "@/components/modules/invoices/dispatch-slip-preview"
import { DeleteInvoiceDialog } from "@/components/modules/invoices/delete-invoice-dialog"
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
import { CheckCircle2, Clock, FileText, Loader2, Pencil, Plus, Printer, Receipt, SlidersHorizontal, Wallet, X } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { formatDateDO } from "@/lib/date-utils"
import { format } from "date-fns"
import Link from "next/link"
import { PageLoading } from "@/components/ui/loading"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvoiceType = any

type Period = "today" | "week" | "month" | "year" | "all"
type StatusFilter = "ALL" | "PAID" | "PENDING" | "CANCELLED"

const PERIODS: { value: Period; label: string }[] = [
    { value: "today", label: "Hoy" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mes" },
    { value: "year", label: "Año" },
    { value: "all", label: "Todo" },
]

const PERIOD_LABELS: Record<Period, string> = {
    today: "Hoy",
    week: "Esta semana",
    month: "Este mes",
    year: "Este año",
    all: "Todo el historial",
}

const STATUS: Record<string, { label: string; tone: PillTone }> = {
    PAID: { label: "Pagada", tone: "green" },
    PENDING: { label: "Pendiente", tone: "amber" },
    CANCELLED: { label: "Cancelada", tone: "slate" },
}

const PAYMENT_METHODS: Record<string, string> = {
    CASH: "Efectivo",
    TRANSFER: "Transferencia",
    CARD: "Tarjeta",
    CHECK: "Cheque",
    CREDIT: "Crédito",
}

const formatSeq = (n: number | string | null | undefined) => `#${String(n ?? "").padStart(6, "0")}`

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<InvoiceType[]>([])
    const [user, setUser] = useState<{ role: string } | null>(null)
    const [settings, setSettings] = useState<CompanySettings | null>(null)
    const [showPrint, setShowPrint] = useState(false)

    // Default to the current month so we don't pull the whole invoice history on load.
    const [period, setPeriod] = useState<Period>("month")
    const [status, setStatus] = useState<StatusFilter>("ALL")
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [minAmount, setMinAmount] = useState("")
    const [maxAmount, setMaxAmount] = useState("")
    const requestId = useRef(0)

    useEffect(() => {
        Promise.all([getCurrentUser(), getCompanySettings()]).then(([userData, settingsData]) => {
            setUser(userData)
            setSettings(settingsData)
        })
    }, [])

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
        return () => clearTimeout(t)
    }, [search])

    const hasDateRange = Boolean(startDate || endDate)

    const query = useMemo(() => ({
        search: debouncedSearch || undefined,
        period: hasDateRange || period === "all" ? undefined : period,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        minAmount: minAmount || undefined,
        maxAmount: maxAmount || undefined,
    }), [debouncedSearch, period, startDate, endDate, minAmount, maxAmount, hasDateRange])
    const queryKey = JSON.stringify(query)
    // La última consulta cuya respuesta ya se muestra; si difiere de la actual, se está cargando.
    const [loadedKey, setLoadedKey] = useState<string | null>(null)
    const loading = loadedKey === null
    const fetching = loadedKey !== queryKey

    useEffect(() => {
        const id = ++requestId.current
        filterInvoices({
            search: query.search,
            period: query.period,
            startDate: query.startDate ? new Date(`${query.startDate}T00:00:00`) : undefined,
            endDate: query.endDate ? new Date(`${query.endDate}T00:00:00`) : undefined,
            minAmount: query.minAmount ? parseFloat(query.minAmount) : undefined,
            maxAmount: query.maxAmount ? parseFloat(query.maxAmount) : undefined,
        })
            .then((data) => {
                if (id === requestId.current) setInvoices(data)
            })
            .finally(() => {
                if (id === requestId.current) setLoadedKey(queryKey)
            })
    }, [query, queryKey])

    const counts = useMemo(() => ({
        ALL: invoices.length,
        PAID: invoices.filter((i) => i.status === "PAID").length,
        PENDING: invoices.filter((i) => i.status === "PENDING").length,
        CANCELLED: invoices.filter((i) => i.status === "CANCELLED").length,
    }), [invoices])

    const visibleInvoices = useMemo(
        () => (status === "ALL" ? invoices : invoices.filter((i) => i.status === status)),
        [invoices, status]
    )

    const stats = useMemo(() => {
        const active = visibleInvoices.filter((i) => i.status !== "CANCELLED")
        return {
            count: visibleInvoices.length,
            total: active.reduce((sum, i) => sum + Number(i.total || 0), 0),
            paid: visibleInvoices.filter((i) => i.status === "PAID").length,
            pending: visibleInvoices.filter((i) => i.status === "PENDING").length,
            receivable: visibleInvoices
                .filter((i) => i.status === "PENDING")
                .reduce((sum, i) => sum + Number(i.balance || 0), 0),
            paidTotal: visibleInvoices
                .filter((i) => i.status === "PAID")
                .reduce((sum, i) => sum + Number(i.total || 0), 0),
        }
    }, [visibleInvoices])

    const advancedCount = [startDate || endDate, minAmount, maxAmount].filter(Boolean).length

    const clearAdvanced = () => {
        setStartDate("")
        setEndDate("")
        setMinAmount("")
        setMaxAmount("")
    }

    const scopeLabel = debouncedSearch
        ? "Todo el historial"
        : hasDateRange
            ? `${startDate ? formatDateDO(`${startDate}T00:00:00`) : "Inicio"} – ${endDate ? formatDateDO(`${endDate}T00:00:00`) : "Hoy"}`
            : PERIOD_LABELS[period]

    const handlePrint = () => {
        setShowPrint(true)
        setTimeout(() => {
            window.print()
            setShowPrint(false)
        }, 100)
    }

    if (loading) {
        return <PageLoading message="Cargando facturas..." />
    }

    const isAdmin = user?.role === 'ADMIN'

    return (
        <>
            <div className="flex-1 space-y-6">
                <PageHeader
                    title="Facturas"
                    description="Consultá, buscá e imprimí las facturas emitidas."
                    actions={
                        <>
                            <Button variant="outline" onClick={handlePrint}>
                                <Printer className="mr-2 h-4 w-4" />
                                Reporte
                            </Button>
                            <Button asChild>
                                <Link href="/invoices/create?type=INVOICE">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Nueva Factura
                                </Link>
                            </Button>
                        </>
                    }
                />

                <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                    <StatTile
                        label="Facturado"
                        value={formatCurrency(stats.total)}
                        hint={`${stats.count} ${stats.count === 1 ? "factura" : "facturas"} · ${scopeLabel}`}
                        icon={<Receipt />}
                        tone="blue"
                    />
                    <StatTile
                        label="Pagadas"
                        value={stats.paid}
                        hint={formatCurrency(stats.paidTotal)}
                        icon={<CheckCircle2 />}
                        tone="green"
                    />
                    <StatTile
                        label="Pendientes"
                        value={stats.pending}
                        hint="Con balance por cobrar"
                        icon={<Clock />}
                        tone="amber"
                    />
                    <StatTile
                        label="Por cobrar"
                        value={formatCurrency(stats.receivable)}
                        hint="Balance pendiente"
                        icon={<Wallet />}
                        tone="red"
                    />
                </div>

                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    {/* Barra de búsqueda y filtros */}
                    <div className="space-y-4 border-b p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            <SearchInput
                                value={search}
                                onChange={setSearch}
                                placeholder="Buscar por número de factura, NCF o cliente..."
                                className="lg:max-w-md lg:flex-1"
                            />
                            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                                <SegmentedControl
                                    options={PERIODS}
                                    value={hasDateRange || debouncedSearch ? ("" as Period) : period}
                                    onChange={(p) => {
                                        setPeriod(p)
                                        setStartDate("")
                                        setEndDate("")
                                    }}
                                />
                                <Button
                                    variant={showAdvanced || advancedCount ? "secondary" : "outline"}
                                    onClick={() => setShowAdvanced((v) => !v)}
                                    className="h-10"
                                >
                                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                                    Filtros
                                    {advancedCount > 0 && (
                                        <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                                            {advancedCount}
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {showAdvanced && (
                            <div className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
                                <FilterField label="Desde">
                                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                </FilterField>
                                <FilterField label="Hasta">
                                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                </FilterField>
                                <FilterField label="Monto mínimo">
                                    <Input type="number" min="0" placeholder="0.00" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
                                </FilterField>
                                <FilterField label="Monto máximo">
                                    <Input type="number" min="0" placeholder="0.00" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
                                </FilterField>
                                <Button variant="ghost" onClick={clearAdvanced} disabled={!advancedCount}>
                                    <X className="mr-1 h-4 w-4" />
                                    Limpiar
                                </Button>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <SegmentedControl
                                options={[
                                    { value: "ALL" as StatusFilter, label: "Todas", count: counts.ALL },
                                    { value: "PAID" as StatusFilter, label: "Pagadas", count: counts.PAID },
                                    { value: "PENDING" as StatusFilter, label: "Pendientes", count: counts.PENDING },
                                    { value: "CANCELLED" as StatusFilter, label: "Canceladas", count: counts.CANCELLED },
                                ]}
                                value={status}
                                onChange={setStatus}
                            />
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                {fetching && <Loader2 className="h-4 w-4 animate-spin" />}
                                {debouncedSearch
                                    ? <>Resultados para <strong className="text-foreground">&ldquo;{debouncedSearch}&rdquo;</strong> en todo el historial</>
                                    : scopeLabel}
                            </p>
                        </div>
                    </div>

                    {visibleInvoices.length === 0 ? (
                        <EmptyList
                            icon={<FileText />}
                            title={debouncedSearch ? "No encontramos facturas" : "No hay facturas en este período"}
                            description={debouncedSearch
                                ? "Probá con otro número, NCF o nombre de cliente."
                                : "Cambiá el período o creá una nueva factura."}
                            action={!debouncedSearch && (
                                <Button asChild size="sm">
                                    <Link href="/invoices/create?type=INVOICE">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Nueva Factura
                                    </Link>
                                </Button>
                            )}
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                    <TableHead className="pl-4">Factura</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="pr-4 text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleInvoices.map((invoice) => {
                                    const st = STATUS[invoice.status] || { label: invoice.status, tone: "slate" as PillTone }
                                    const balance = Number(invoice.balance || 0)
                                    return (
                                        <TableRow key={invoice.id} className="group">
                                            <TableCell className="py-3 pl-4">
                                                <p className="font-mono font-semibold text-blue-700">{formatSeq(invoice.sequenceNumber)}</p>
                                                <p className="font-mono text-xs text-muted-foreground">
                                                    {invoice.ncf ? `NCF ${invoice.ncf}` : "Sin NCF"}
                                                </p>
                                            </TableCell>
                                            <TableCell className="max-w-[280px] py-3">
                                                <ClientCell
                                                    name={invoice.clientName || invoice.client?.name || "Consumidor Final"}
                                                    detail={PAYMENT_METHODS[invoice.paymentMethod] || invoice.paymentMethod}
                                                />
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <p>{formatDateDO(invoice.createdAt)}</p>
                                                <p className="text-xs text-muted-foreground">{format(new Date(invoice.createdAt), "hh:mm a")}</p>
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <StatusPill tone={st.tone}>{st.label}</StatusPill>
                                            </TableCell>
                                            <TableCell className="py-3 text-right">
                                                <p className="font-semibold tabular-nums">{formatCurrency(Number(invoice.total))}</p>
                                                {invoice.status === "PENDING" && balance > 0 && (
                                                    <p className="text-xs tabular-nums text-amber-700">Debe {formatCurrency(balance)}</p>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-3 pr-4 text-right">
                                                <div className="flex justify-end gap-1">
                                                    {isAdmin && (
                                                        <Button asChild variant="ghost" size="icon" title="Editar Factura">
                                                            <Link href={`/invoices/${invoice.id}/edit`}>
                                                                <Pencil className="h-4 w-4 text-blue-500" />
                                                            </Link>
                                                        </Button>
                                                    )}
                                                    <InvoicePreviewDialog invoice={invoice} settings={settings || undefined} />
                                                    <DispatchSlipPreviewDialog invoice={invoice} settings={settings || undefined} />
                                                    {isAdmin && <DeleteInvoiceDialog invoiceId={invoice.id} />}
                                                </div>
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
                    <InvoiceReportPrint
                        invoices={visibleInvoices}
                        stats={stats}
                        filters={{
                            period: hasDateRange || debouncedSearch ? undefined : PERIOD_LABELS[period],
                            startDate: startDate || undefined,
                            endDate: endDate || undefined,
                            minAmount: minAmount || undefined,
                            maxAmount: maxAmount || undefined,
                        }}
                    />
                </div>
            )}
        </>
    )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            {children}
        </label>
    )
}
