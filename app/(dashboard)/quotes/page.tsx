"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { getQuotes } from "@/actions/quote-actions"
import { QuoteList } from "@/components/modules/quotes/quote-list"
import { es } from "date-fns/locale"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CalendarDays, CheckCircle2, Clock, FileText, History, Loader2, Plus, TrendingUp } from "lucide-react"
import { PageHeader, SearchInput, SegmentedControl, StatTile } from "@/components/modules/shared/list-page"
import { formatCurrency } from "@/lib/utils"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QuoteAny = any

function QuotesPageContent() {
    const [quotes, setQuotes] = useState<QuoteAny[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshTrigger, setRefreshTrigger] = useState(0)
    const [query, setQuery] = useState("")
    const [status, setStatus] = useState("ALL")
    // Default to the current month so we don't pull the whole quote history on load.
    const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"))
    const [showAll, setShowAll] = useState(false)

    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1)

    useEffect(() => {
        let active = true

        const load = async () => {
            setLoading(true)
            try {
                const data = await getQuotes({ month, all: showAll })
                if (active) setQuotes(data)
            } finally {
                if (active) setLoading(false)
            }
        }
        void load()

        return () => {
            active = false
        }
    }, [refreshTrigger, month, showAll])

    const visibleQuotes = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()

        return quotes.filter((quote: QuoteAny) => {
            if (status === "DRAFT" && !quote.isDraft) return false
            if (status !== "ALL" && status !== "DRAFT" && (quote.isDraft || quote.status !== status)) return false

            if (!normalizedQuery) return true

            const seq = quote.sequenceNumber != null ? String(quote.sequenceNumber) : ""
            const paddedSeq = seq ? seq.padStart(6, "0") : ""
            const formattedSeq = seq ? `#${paddedSeq}` : ""
            const simpleFormattedSeq = seq ? `#${seq}` : ""
            const cotSeq = seq ? `cot-${seq}` : ""
            const cotPaddedSeq = seq ? `cot-${paddedSeq}` : ""
            const clientRnc = quote.client?.rnc || ""
            const clientCedula = quote.client?.cedula || ""

            const text = `${seq} ${paddedSeq} ${formattedSeq} ${simpleFormattedSeq} ${cotSeq} ${cotPaddedSeq} ${quote.clientName || quote.client?.name || ""} ${clientRnc} ${clientCedula} ${quote.status || ""} ${quote.isDraft ? "borrador draft" : ""} ${quote.total}`.toLowerCase()
            return text.includes(normalizedQuery)
        })
    }, [query, quotes, status])

    const counts = useMemo(() => ({
        ALL: quotes.length,
        PENDING: quotes.filter((q: QuoteAny) => !q.isDraft && q.status === "PENDING").length,
        ACCEPTED: quotes.filter((q: QuoteAny) => q.status === "ACCEPTED").length,
        EXPIRED: quotes.filter((q: QuoteAny) => !q.isDraft && q.status === "EXPIRED").length,
        REJECTED: quotes.filter((q: QuoteAny) => q.status === "REJECTED").length,
        DRAFT: quotes.filter((q: QuoteAny) => q.isDraft).length,
    }), [quotes])

    const stats = useMemo(() => {
        const sum = (list: QuoteAny[]) => list.reduce((acc, q) => acc + Number(q.total || 0), 0)
        const pending = quotes.filter((q: QuoteAny) => !q.isDraft && q.status === "PENDING")
        const accepted = quotes.filter((q: QuoteAny) => q.status === "ACCEPTED")
        const decided = quotes.filter((q: QuoteAny) => !q.isDraft && q.status !== "PENDING")
        return {
            total: sum(quotes.filter((q: QuoteAny) => !q.isDraft)),
            pendingTotal: sum(pending),
            acceptedTotal: sum(accepted),
            conversion: decided.length ? Math.round((accepted.length / decided.length) * 100) : null,
        }
    }, [quotes])

    const scopeLabel = showAll
        ? "Todo el historial"
        : format(new Date(`${month}-01T00:00:00`), "MMMM yyyy", { locale: es })

    return (
        <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 pt-6 md:p-8">
            <PageHeader
                title="Cotizaciones"
                description="Prepará presupuestos, dales seguimiento y convertilos en factura."
                actions={
                    <Button asChild>
                        <Link href="/invoices/create?type=QUOTE">
                            <Plus className="mr-2 h-4 w-4" />
                            Nueva Cotización
                        </Link>
                    </Button>
                }
            />

            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatTile
                    label="Cotizado"
                    value={formatCurrency(stats.total)}
                    hint={<span className="capitalize">{scopeLabel}</span>}
                    icon={<FileText />}
                    tone="blue"
                />
                <StatTile
                    label="Pendientes"
                    value={counts.PENDING}
                    hint={`${formatCurrency(stats.pendingTotal)} en espera`}
                    icon={<Clock />}
                    tone="amber"
                />
                <StatTile
                    label="Aceptadas"
                    value={counts.ACCEPTED}
                    hint={`${formatCurrency(stats.acceptedTotal)} facturado`}
                    icon={<CheckCircle2 />}
                    tone="green"
                />
                <StatTile
                    label="Tasa de cierre"
                    value={stats.conversion === null ? "—" : `${stats.conversion}%`}
                    hint={`${counts.EXPIRED} ${counts.EXPIRED === 1 ? "vencida" : "vencidas"}`}
                    icon={<TrendingUp />}
                    tone="slate"
                />
            </div>

            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="space-y-4 border-b p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <SearchInput
                            value={query}
                            onChange={setQuery}
                            placeholder="Buscar por número, cliente, RNC o monto..."
                            className="lg:max-w-md lg:flex-1"
                        />
                        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                            <div className="relative">
                                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    aria-label="Mes"
                                    type="month"
                                    className="h-10 w-44 pl-9"
                                    value={month}
                                    disabled={showAll}
                                    onChange={(event) => setMonth(event.target.value)}
                                />
                            </div>
                            <Button
                                variant={showAll ? "secondary" : "outline"}
                                className="h-10"
                                onClick={() => setShowAll((prev) => !prev)}
                                title="Cargar todas las cotizaciones sin filtrar por mes"
                            >
                                <History className="mr-2 h-4 w-4" />
                                {showAll ? "Viendo todo" : "Todo el historial"}
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <SegmentedControl
                            options={[
                                { value: "ALL", label: "Todas", count: counts.ALL },
                                { value: "PENDING", label: "Pendientes", count: counts.PENDING },
                                { value: "ACCEPTED", label: "Aceptadas", count: counts.ACCEPTED },
                                { value: "EXPIRED", label: "Vencidas", count: counts.EXPIRED },
                                { value: "REJECTED", label: "Rechazadas", count: counts.REJECTED },
                                { value: "DRAFT", label: "Borradores", count: counts.DRAFT },
                            ]}
                            value={status}
                            onChange={setStatus}
                        />
                        <p className="text-sm capitalize text-muted-foreground">{scopeLabel}</p>
                    </div>
                </div>

                {!loading && visibleQuotes.length === 0 && query.trim() !== "" && !showAll && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
                        <span>No hay cotizaciones de este mes para &quot;{query}&quot;.</span>
                        <Button size="sm" variant="outline" className="border-amber-600 text-amber-800 hover:bg-amber-100" onClick={() => setShowAll(true)}>
                            Buscar en todo el historial
                        </Button>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando cotizaciones...
                    </div>
                ) : (
                    <QuoteList quotes={visibleQuotes} onRefresh={triggerRefresh} />
                )}
            </div>
        </div>
    )
}

export default function QuotesPage() {
    return <QuotesPageContent />
}
