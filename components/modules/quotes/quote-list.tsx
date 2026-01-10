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
import { formatCurrency, formatDateDO } from "@/lib/utils"
// import { format } from "date-fns" // Client side usage
import { convertQuoteToInvoice } from "@/actions/quote-actions"
import { ArrowRight, Printer } from "lucide-react"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function QuoteList({ quotes }: { quotes: any[] }) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {quotes.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No hay cotizaciones</TableCell></TableRow>}
                    {quotes.map((quote) => (
                        <TableRow key={quote.id}>
                            <TableCell>{formatDateDO(quote.createdAt)}</TableCell>
                            <TableCell>{quote.clientName || quote.client?.name || "Cliente"}</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(Number(quote.total))}</TableCell>
                            <TableCell>{quote.status}</TableCell>
                            <TableCell className="text-right">
                                {quote.status === "PENDING" && (
                                    <Button size="sm" variant="outline" onClick={async () => {
                                        if (confirm("Confirmar conversion a factura?")) {
                                            const res = await convertQuoteToInvoice(quote.id)
                                            if (res.success) alert("Convertido a Factura!")
                                            else alert("Error: " + res.error)
                                        }
                                    }}>
                                        <ArrowRight className="mr-2 h-4 w-4" /> Facturar
                                    </Button>
                                )}
                                <Button size="sm" variant="ghost">
                                    <Printer className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
