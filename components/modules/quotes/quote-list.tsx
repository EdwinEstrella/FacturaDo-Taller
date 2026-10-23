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
import { ArrowRight, Printer, Trash2, Pencil, RotateCcw, Loader2, FileText, Plus } from "lucide-react"
import { differenceInCalendarDays } from "date-fns"
import Link from "next/link"
import { ClientCell, EmptyList, StatusPill, type PillTone } from "@/components/modules/shared/list-page"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function quoteStatus(quote: any): { label: string; tone: PillTone } {
    if (quote.isDraft) return { label: "Borrador", tone: "slate" }
    if (quote.status === "ACCEPTED") return { label: "Aceptada", tone: "green" }
    if (quote.status === "EXPIRED") return { label: "Vencida", tone: "red" }
    if (quote.status === "REJECTED") return { label: "Rechazada", tone: "slate" }
    return { label: "Pendiente", tone: "amber" }
}

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
        <div>
            {quotes.length === 0 ? (
                <EmptyList
                    icon={<FileText />}
                    title="No hay cotizaciones"
                    description="Cambiá el mes o los filtros, o creá una nueva cotización."
                    action={
                        <Button asChild size="sm">
                            <Link href="/invoices/create?type=QUOTE">
                                <Plus className="mr-2 h-4 w-4" />
                                Nueva Cotización
                            </Link>
                        </Button>
                    }
                />
            ) : (
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="pl-4">Cotización</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Vigencia</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="pr-4 text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {quotes.map((quote) => {
                        const isExpired = !quote.isDraft && quote.status === "EXPIRED"
                        const isOpen = !quote.isDraft && quote.status === "PENDING"
                        const quoteNumber = quote.sequenceNumber
                            ? `#${String(quote.sequenceNumber).padStart(6, "0")}`
                            : `#${String(quote.id || "").slice(-6).toUpperCase()}`
                        const st = quoteStatus(quote)
                        const days = quote.validUntil ? differenceInCalendarDays(new Date(quote.validUntil), new Date()) : null
                        const clientRnc = quote.client?.rnc || quote.client?.cedula

                        return (
                            <TableRow key={quote.id}>
                                <TableCell className="py-3 pl-4">
                                    <p className="font-mono font-semibold text-blue-700">{quoteNumber}</p>
                                    <p className="text-xs text-muted-foreground">{formatDateDO(quote.createdAt)}</p>
                                </TableCell>
                                <TableCell className="max-w-[280px] py-3">
                                    <ClientCell
                                        name={quote.clientName || quote.client?.name || "Cliente"}
                                        detail={clientRnc ? `RNC / Céd. ${clientRnc}` : undefined}
                                    />
                                </TableCell>
                                <TableCell className="py-3">
                                    <p>{quote.validUntil ? formatDateDO(quote.validUntil) : "—"}</p>
                                    {isOpen && days !== null && (
                                        <p className={`text-xs ${days <= 3 ? "text-amber-700" : "text-muted-foreground"}`}>
                                            {days <= 0 ? "Vence hoy" : days === 1 ? "Vence mañana" : `Vence en ${days} días`}
                                        </p>
                                    )}
                                    {isExpired && <p className="text-xs text-red-600">Vencida</p>}
                                </TableCell>
                                <TableCell className="py-3">
                                    <StatusPill tone={st.tone}>{st.label}</StatusPill>
                                </TableCell>
                                <TableCell className="py-3 text-right font-semibold tabular-nums">
                                    {formatCurrency(Number(quote.total))}
                                </TableCell>
                                <TableCell className="py-3 pr-4">
                                    <div className="flex items-center justify-end gap-1">
                                        {isOpen && (
                                            <Button size="sm" className="mr-1" onClick={() => router.push(`/invoices/create?sourceQuoteId=${quote.id}`)}>
                                                Facturar
                                                <ArrowRight className="ml-1.5 h-4 w-4" />
                                            </Button>
                                        )}
                                        {isExpired && (
                                            <Button size="sm" variant="outline" className="mr-1" onClick={() => openDialog('renew', quote.id)}>
                                                <RotateCcw className="mr-1.5 h-4 w-4" />
                                                Renovar
                                            </Button>
                                        )}
                                        {(isOpen || quote.isDraft) && (
                                            <Button size="icon" variant="ghost" title="Editar" onClick={() => router.push(`/quotes/${quote.id}/edit`)}>
                                                <Pencil className="h-4 w-4 text-blue-500" />
                                            </Button>
                                        )}
                                        <Button size="icon" variant="ghost" title="Imprimir" onClick={() => router.push(`/quotes/${quote.id}/print`)}>
                                            <Printer className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" title="Eliminar" onClick={() => openDialog('delete', quote.id)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
            )}

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
