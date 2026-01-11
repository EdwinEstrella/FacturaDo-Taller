"use client"

import { useEffect, useState } from "react"
import { getQuotes } from "@/actions/quote-actions"
import { QuoteList } from "@/components/modules/quotes/quote-list"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function QuotesPage() {
    const [quotes, setQuotes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const searchParams = useSearchParams()
    const query = searchParams.get("q") ?? ""

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            const data = await getQuotes()
            // filtro simple en cliente por ahora: cliente o estado o total en texto
            const filtered = query
                ? data.filter((q: any) => {
                    const text = `${q.clientName || q.client?.name || ""} ${q.status || ""} ${q.total}`.toLowerCase()
                    return text.includes(query.toLowerCase())
                })
                : data
            setQuotes(filtered)
            setLoading(false)
        }
        void load()
    }, [query])

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

            <form className="flex gap-4 items-end border p-4 rounded-lg bg-gray-50" action={""}>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="searchQuotes">Buscar</Label>
                    <Input
                        id="searchQuotes"
                        name="q"
                        placeholder="Buscar por cliente, estado o monto..."
                        defaultValue={query}
                    />
                </div>
                <Button type="submit" variant="outline">Filtrar</Button>
            </form>

            {loading ? (
                <div className="p-4">Cargando cotizaciones...</div>
            ) : (
                <QuoteList quotes={quotes} />
            )}
        </div>
    )
}