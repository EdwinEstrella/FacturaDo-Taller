"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import { formatCurrency } from "@/lib/utils"
import { formatPaymentMethod } from "@/lib/payment-methods"
import {
    getInvoicePaymentHistory,
    getPaymentReceipt,
    type InvoicePaymentHistoryResult,
} from "@/actions/receivables-actions"
import { History, Loader2, Printer } from "lucide-react"
import type { PaymentReceiptItem } from "./payment-receipt-template"
import { usePaymentReceiptPrinter } from "./use-payment-receipt-printer"
import { toast } from "sonner"

interface PaymentHistoryDialogProps {
    invoice: {
        id: string
        sequenceNumber: number
        clientName?: string
        total: number
    }
}

export function PaymentHistoryDialog({ invoice }: PaymentHistoryDialogProps) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [history, setHistory] = useState<InvoicePaymentHistoryResult | null>(null)
    const [fetchingReceiptId, setFetchingReceiptId] = useState<string | null>(null)

    const { printReceipt, printingId, ReceiptPortal } = usePaymentReceiptPrinter()

    const loadHistory = () => {
        startTransition(async () => {
            const res = await getInvoicePaymentHistory(invoice.id)
            if (res.success && res.data) {
                setHistory(res.data)
            } else {
                toast.error(res.error || "Error al cargar historial de pagos")
            }
        })
    }

    const handleOpenChange = (val: boolean) => {
        setOpen(val)
        if (val) {
            loadHistory()
        } else {
            setFetchingReceiptId(null)
        }
    }

    const handleReprint = async (payment: PaymentReceiptItem) => {
        setFetchingReceiptId(payment.id)
        try {
            const res = await getPaymentReceipt(payment.id)
            if (res.success && res.data) {
                printReceipt(res.data)
            } else {
                toast.error(res.error || "Error al obtener recibo de pago")
            }
        } catch (err) {
            console.error("Error fetching payment receipt:", err)
            toast.error("Error al obtener recibo de pago")
        } finally {
            setFetchingReceiptId(null)
        }
    }

    const formatDate = (date: Date | string) => {
        if (!date) return "-"
        const d = new Date(date)
        return new Intl.DateTimeFormat("es-DO", {
            timeZone: "America/Santo_Domingo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        }).format(d)
    }

    const totalInvoice = history ? history.invoice.total : Number(invoice.total || 0)
    const totalPaid = history ? history.totalPaid : 0
    const balance = history ? history.balance : 0
    const credited = history ? history.credited : 0

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-slate-300 hover:bg-slate-50">
                    <History className="mr-1.5 h-4 w-4 text-slate-600" />
                    Historial
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <History className="h-5 w-5 text-blue-600" />
                        Historial de Abonos - Factura #{invoice.sequenceNumber}
                    </DialogTitle>
                    <DialogDescription>
                        Cliente: <strong className="text-slate-800">{invoice.clientName || "Consumidor Final"}</strong>
                    </DialogDescription>
                </DialogHeader>

                {/* Totals Summary Cards */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 my-2 text-xs">
                    <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                        <span className="text-slate-500 block">Total Factura</span>
                        <span className="font-bold text-slate-900 text-sm">{formatCurrency(totalInvoice)}</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded p-2.5">
                        <span className="text-emerald-700 block">Total Abonado</span>
                        <span className="font-bold text-emerald-700 text-sm">{formatCurrency(totalPaid)}</span>
                    </div>
                    {credited > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded p-2.5">
                            <span className="text-amber-700 block">Nota Crédito</span>
                            <span className="font-bold text-amber-700 text-sm">-{formatCurrency(credited)}</span>
                        </div>
                    )}
                    <div className={`border rounded p-2.5 ${
                        balance <= 0.01
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-rose-50 border-rose-200"
                    }`}>
                        <span className={`block ${balance <= 0.01 ? "text-emerald-700" : "text-rose-700"}`}>
                            Resta
                        </span>
                        <span className={`font-bold text-sm ${balance <= 0.01 ? "text-emerald-700" : "text-rose-700"}`}>
                            {balance <= 0.01 ? "SALDADO" : formatCurrency(balance)}
                        </span>
                    </div>
                </div>

                {/* Payments Table */}
                <div className="rounded-md border my-2 overflow-hidden">
                    {isPending ? (
                        <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                            <span>Cargando historial de pagos...</span>
                        </div>
                    ) : !history || history.payments.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-sm">
                            No hay abonos registrados para esta factura.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Método</TableHead>
                                    <TableHead>Referencia / Nota</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.payments.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="text-xs whitespace-nowrap">
                                            {formatDate(p.date)}
                                        </TableCell>
                                        <TableCell className="text-xs font-medium">
                                            {formatPaymentMethod(p.method)}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-600 max-w-[180px] truncate" title={p.notes || p.reference || ""}>
                                            {p.reference && <span className="font-medium mr-1">{p.reference}</span>}
                                            {p.notes && <span className="italic text-slate-500">{p.notes}</span>}
                                            {!p.reference && !p.notes && "-"}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-xs text-slate-900">
                                            {formatCurrency(p.amount)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleReprint(p)}
                                                disabled={fetchingReceiptId === p.id || printingId === p.id}
                                                className="h-8 px-2 text-xs border-slate-300 hover:bg-slate-100"
                                                title="Reimprimir recibo de este pago"
                                            >
                                                {fetchingReceiptId === p.id || printingId === p.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                                ) : (
                                                    <Printer className="h-3.5 w-3.5 mr-1 text-slate-600" />
                                                )}
                                                Reimprimir
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cerrar
                    </Button>
                </DialogFooter>

                <ReceiptPortal />
            </DialogContent>
        </Dialog>
    )
}
