"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { formatDateDO } from "@/lib/date-utils"
import { convertQuoteToInvoice, deleteQuote } from "@/actions/quote-actions"
import { ArrowRight, Printer, Trash2, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function QuoteList({ quotes }: { quotes: any[] }) {
    const router = useRouter()

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {quotes.length === 0 && <TableRow><TableCell colSpan={6} className="text-center">No hay cotizaciones</TableCell></TableRow>}
                    {quotes.map((quote) => {
                        const isExpired = quote.status === "EXPIRED" || (quote.validUntil && new Date(quote.validUntil) < new Date())
                        const validUntilText = quote.validUntil ? formatDateDO(quote.validUntil) : "N/A"

                        return (
                            <TableRow key={quote.id} className={isExpired ? "bg-red-50" : ""}>
                                <TableCell>{formatDateDO(quote.createdAt)}</TableCell>
                                <TableCell>
                                    {isExpired && <AlertTriangle className="h-4 w-4 text-red-500 inline mr-1" />}
                                    {validUntilText}
                                </TableCell>
                                <TableCell>{quote.clientName || quote.client?.name || "Cliente"}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(Number(quote.total))}</TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                        quote.status === "ACCEPTED" ? "bg-green-100 text-green-800" :
                                        quote.status === "EXPIRED" || isExpired ? "bg-red-100 text-red-800" :
                                        quote.status === "REJECTED" ? "bg-gray-100 text-gray-800" :
                                        "bg-yellow-100 text-yellow-800"
                                    }`}>
                                        {quote.status === "ACCEPTED" ? "Aceptada" :
                                         quote.status === "EXPIRED" ? "Vencida" :
                                         quote.status === "REJECTED" ? "Rechazada" :
                                         "Pendiente"}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    {quote.status === "PENDING" && !isExpired && (
                                        <Button size="sm" variant="outline" onClick={async () => {
                                            if (confirm("¿Confirmar conversión a factura?")) {
                                                const res = await convertQuoteToInvoice(quote.id)
                                                if (res.success) {
                                                    alert("¡Convertido a Factura!")
                                                    router.refresh()
                                                } else {
                                                    alert("Error: " + res.error)
                                                }
                                            }
                                        }}>
                                            <ArrowRight className="mr-2 h-4 w-4" /> Facturar
                                        </Button>
                                    )}
                                    <Button size="sm" variant="ghost" onClick={() => router.push(`/quotes/${quote.id}/print`)}>
                                        <Printer className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={async () => {
                                        if (confirm("¿Eliminar esta cotización permanentemente?")) {
                                            const res = await deleteQuote(quote.id)
                                            if (res.success) {
                                                router.refresh()
                                            } else {
                                                alert("Error: " + res.error)
                                            }
                                        }
                                    }}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
