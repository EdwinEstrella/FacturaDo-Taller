"use client"

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { formatDateDO } from "@/lib/date-utils"
import { convertQuoteToInvoice, deleteQuote, renewQuote } from "@/actions/quote-actions"
import { ArrowRight, Printer, Trash2, AlertTriangle, Pencil, RotateCcw, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function QuoteList({ quotes, onRefresh }: { quotes: any[], onRefresh?: () => void }) {
    const router = useRouter()
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        type: 'renew' | 'convert' | 'delete' | null;
        quoteId: string | null;
        isLoading: boolean;
    }>({ isOpen: false, type: null, quoteId: null, isLoading: false })

    const handleAction = async () => {
        if (!dialogState.quoteId || !dialogState.type) return;
        
        setDialogState(prev => ({ ...prev, isLoading: true }))
        
        try {
            let res;
            if (dialogState.type === 'renew') {
                res = await renewQuote(dialogState.quoteId)
                if (res.success) toast.success("Cotización renovada por 15 días más")
            } else if (dialogState.type === 'convert') {
                res = await convertQuoteToInvoice(dialogState.quoteId)
                if (res.success) toast.success("Convertida a Factura exitosamente")
            } else if (dialogState.type === 'delete') {
                res = await deleteQuote(dialogState.quoteId)
                if (res.success) toast.success("Cotización eliminada")
            }

            if (res && !res.success) {
                toast.error("Error: " + res.error)
            } else {
                if (onRefresh) onRefresh()
                router.refresh()
            }
        } catch (error) {
            toast.error("Ocurrió un error inesperado")
        } finally {
            setDialogState({ isOpen: false, type: null, quoteId: null, isLoading: false })
        }
    }

    const openDialog = (type: 'renew' | 'convert' | 'delete', quoteId: string) => {
        setDialogState({ isOpen: true, type, quoteId, isLoading: false })
    }

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
                        const isExpired = !quote.isDraft && quote.status === "EXPIRED"
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
                                        quote.isDraft ? "bg-slate-100 text-slate-800" :
                                        quote.status === "ACCEPTED" ? "bg-green-100 text-green-800" :
                                        quote.status === "EXPIRED" || isExpired ? "bg-red-100 text-red-800" :
                                        quote.status === "REJECTED" ? "bg-gray-100 text-gray-800" :
                                        "bg-yellow-100 text-yellow-800"
                                    }`}>
                                        {quote.isDraft ? "Borrador" :
                                         quote.status === "ACCEPTED" ? "Aceptada" :
                                         quote.status === "EXPIRED" ? "Vencida" :
                                         quote.status === "REJECTED" ? "Rechazada" :
                                         "Pendiente"}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    {quote.status === "PENDING" && !isExpired && (
                                        <Button size="sm" variant="outline" onClick={() => router.push(`/invoices/create?sourceQuoteId=${quote.id}`)}>
                                            <ArrowRight className="mr-2 h-4 w-4" /> Facturar
                                        </Button>
                                    )}
                                    {(!isExpired && quote.status === "PENDING") && (
                                        <Button size="sm" variant="ghost" onClick={() => router.push(`/quotes/${quote.id}/edit`)}>
                                            <Pencil className="h-4 w-4 text-blue-500" />
                                        </Button>
                                    )}
                                    {isExpired && (
                                        <Button size="sm" variant="ghost" onClick={() => openDialog('renew', quote.id)} title="Renovar cotización">
                                            <RotateCcw className="h-4 w-4 text-green-600" />
                                        </Button>
                                    )}
                                    <Button size="sm" variant="ghost" onClick={() => router.push(`/quotes/${quote.id}/print`)}>
                                        <Printer className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => openDialog('delete', quote.id)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>

            <AlertDialog open={dialogState.isOpen} onOpenChange={(open) => !dialogState.isLoading && setDialogState(prev => ({ ...prev, isOpen: open }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {dialogState.type === 'renew' ? 'Renovar cotización' :
                             dialogState.type === 'convert' ? 'Convertir a factura' :
                             'Eliminar cotización'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {dialogState.type === 'renew' ? 'Esta acción volverá el estado a Pendiente y extenderá el plazo 15 días más.' :
                             dialogState.type === 'convert' ? 'Se creará una factura con los detalles de esta cotización. El inventario se descontará.' :
                             '¿Estás seguro de que quieres eliminar esta cotización de forma permanente? Esta acción no se puede deshacer.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={dialogState.isLoading}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={(e) => { e.preventDefault(); handleAction(); }}
                            disabled={dialogState.isLoading}
                            className={dialogState.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
                        >
                            {dialogState.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
