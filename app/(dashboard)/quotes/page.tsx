"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { getQuotes } from "@/actions/quote-actions"
import { QuoteList } from "@/components/modules/quotes/quote-list"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PageLoading } from "@/components/ui/loading"
import { X } from "lucide-react"

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
            if (status !== "ALL" && status !== "DRAFT" && quote.status !== status) return false

            if (!normalizedQuery) return true

            const text = `${quote.clientName || quote.client?.name || ""} ${quote.status || ""} ${quote.isDraft ? "borrador draft" : ""} ${quote.total}`.toLowerCase()
            return text.includes(normalizedQuery)
        })
    }, [query, quotes, status])

    const clearFilters = () => {
        setQuery("")
        setStatus("ALL")
    }

    const hasActiveFilters = Boolean(query || status !== "ALL")

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Cotizaciones</h2>
                <div className="flex gap-2">
                    <Link href="/invoices/create?type=QUOTE">
                        <Button variant="outline" className="border-yellow-500 text-yellow-600 hover:bg-yellow-50">
                            Nueva Cotización
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Mes</span>
                    <Input
                        aria-label="Mes"
                        type="month"
                        className="h-9 w-40"
                        value={month}
                        disabled={showAll}
                        onChange={(event) => setMonth(event.target.value)}
                    />
                    <Button
                        variant={showAll ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowAll((prev) => !prev)}
                        title="Cargar todas las cotizaciones sin filtrar por mes"
                    >
                        Todas
                    </Button>
                </div>
                <Input
                    aria-label="Buscar cotización"
                    className="h-9 w-72"
                    placeholder="Buscar cliente, estado o monto..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
                {[
                    ["PENDING", "Pendientes"],
                    ["ACCEPTED", "Aceptadas"],
                    ["REJECTED", "Rechazadas"],
                    ["DRAFT", "Borradores"],
                ].map(([value, label]) => (
                    <Button
                        key={value}
                        variant={status === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatus(status === value ? "ALL" : value)}
                    >
                        {label}
                    </Button>
                ))}
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} title="Limpiar filtros" aria-label="Limpiar filtros">
                        <X className="mr-1 h-4 w-4" />
                        Limpiar
                    </Button>
                )}
            </div>

            {loading ? (
                <PageLoading message="Cargando cotizaciones..." />
            ) : (
                <QuoteList quotes={visibleQuotes} onRefresh={triggerRefresh} />
            )}
        </div>
    )
}

export default function QuotesPage() {
    return <QuotesPageContent />
}
