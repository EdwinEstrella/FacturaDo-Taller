"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { formatCurrency } from "@/lib/utils"
import { getPaymentReceipt, registerPayment } from "@/actions/receivables-actions"
import { toast } from "sonner"
import { Check, CheckCircle2, DollarSign, Printer } from "lucide-react"
import { useRouter } from "next/navigation"
import { useShiftGuard } from "@/components/modules/cash-close/closed-shift-dialog"
import type { PaymentReceiptData } from "./payment-receipt-template"
import { usePaymentReceiptPrinter } from "./use-payment-receipt-printer"

interface SerializedInvoice {
    id: string
    sequenceNumber: number
    balance: number
    total: number
}

export function PaymentDialog({ invoice }: { invoice: SerializedInvoice }) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const { requireShift } = useShiftGuard()

    // Safely derive balance without the falsy 0 || total bug
    const balance =
        invoice.balance !== undefined && invoice.balance !== null
            ? Number(invoice.balance)
            : Number(invoice.total || 0)

    const [amount, setAmount] = useState(balance)
    const [method, setMethod] = useState("CASH")
    const [reference, setReference] = useState("")
    const [notes, setNotes] = useState("")
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [receipt, setReceipt] = useState<PaymentReceiptData | null>(null)

    const router = useRouter()
    const { printReceipt, isPrinting, ReceiptPortal } = usePaymentReceiptPrinter()

    const resetForm = () => {
        setAmount(balance)
        setMethod("CASH")
        setReference("")
        setNotes("")
        setDate(new Date())
        setReceipt(null)
    }

    const handleConfirm = () => {
        if (!requireShift()) return
        if (!amount || amount <= 0) return toast.error("Monto inválido")
        if (amount > balance + 0.01) return toast.error("El monto excede el balance")

        startTransition(async () => {
            const res = await registerPayment({
                invoiceId: invoice.id,
                amount,
                method,
                reference,
                notes,
                date,
            })

            if (res.success && res.paymentId) {
                toast.success("Pago registrado correctamente")
                const receiptRes = await getPaymentReceipt(res.paymentId)
                if (receiptRes.success && receiptRes.data) {
                    setReceipt(receiptRes.data)
                    printReceipt(receiptRes.data)
                } else {
                    setOpen(false)
                    resetForm()
                }
                router.refresh()
            } else {
                if (res.error?.includes("turno de caja") || res.error?.includes("apertura de caja")) {
                    setOpen(false)
                    requireShift()
                } else {
                    toast.error("Error: " + res.error)
                }
            }
        })
    }

    const handleTriggerClick = (e: React.MouseEvent) => {
        if (!requireShift()) {
            e.preventDefault()
            e.stopPropagation()
        }
    }

    const handleOpenChange = (val: boolean) => {
        if (val && !requireShift()) return
        setOpen(val)
        if (val) {
            resetForm()
        } else {
            setReceipt(null)
        }
    }

    const currentPayment = receipt?.payments.find((p) => p.id === receipt.paymentId)

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    onClick={handleTriggerClick}
                    size="sm"
                    variant="outline"
                    className="border-green-500 text-green-600 hover:bg-green-50"
                >
                    <DollarSign className="mr-2 h-4 w-4" />
                    Registrar Abono
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                {receipt ? (
                    <>
                        <DialogHeader className="text-center space-y-1">
                            <CheckCircle2 className="size-12 text-emerald-600 mx-auto" />
                            <DialogTitle className="text-xl font-bold text-slate-900">
                                ¡Abono Registrado con Éxito!
                            </DialogTitle>
                            <DialogDescription>
                                Factura #{invoice.sequenceNumber} - Comprobante de pago generado.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs my-2">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                <span className="text-slate-600">Factura:</span>
                                <span className="font-bold text-slate-900">#{invoice.sequenceNumber}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Monto abonado:</span>
                                <span className="font-bold text-slate-900 text-sm">
                                    {formatCurrency(currentPayment ? Number(currentPayment.amount) : amount)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Total abonado:</span>
                                <span className="font-medium text-slate-700">
                                    {formatCurrency(receipt.totalPaid)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm">
                                <span className="font-bold text-slate-800">Balance restante:</span>
                                <span
                                    className={`font-bold ${
                                        receipt.balance <= 0.01 ? "text-emerald-600" : "text-red-600"
                                    }`}
                                >
                                    {receipt.balance <= 0.01 ? "SALDADO" : formatCurrency(receipt.balance)}
                                </span>
                            </div>
                        </div>

                        <DialogFooter className="grid grid-cols-2 gap-2 pt-2 sm:space-x-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => receipt && printReceipt(receipt)}
                                disabled={isPrinting}
                                className="font-semibold flex items-center justify-center gap-2 border-slate-300"
                            >
                                <Printer className="size-4" />
                                Reimprimir recibo
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    setOpen(false)
                                    setReceipt(null)
                                    router.refresh()
                                }}
                                className="font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                            >
                                <Check className="size-4" />
                                Cerrar
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Registrar Pago / Abono</DialogTitle>
                            <DialogDescription>
                                Factura #{invoice.sequenceNumber} - Balance:{" "}
                                <span className="font-bold text-red-600">{formatCurrency(balance)}</span>
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Monto a Pagar</label>
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    max={balance}
                                />
                            </div>

                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Método de Pago</label>
                                <Select value={method} onValueChange={setMethod}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="z-[101]">
                                        <SelectItem value="CASH">Efectivo</SelectItem>
                                        <SelectItem value="TRANSFER">Transferencia</SelectItem>
                                        <SelectItem value="CHECK">Cheque</SelectItem>
                                        <SelectItem value="CARD">Tarjeta</SelectItem>
                                        <SelectItem value="OTHER">Otro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Fecha</label>
                                <DatePicker date={date} setDate={setDate} />
                            </div>

                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Referencia / No. Comprobante</label>
                                <Input
                                    placeholder="Ej: No. Transferencia, Cheque..."
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                />
                            </div>

                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Notas</label>
                                <Textarea
                                    placeholder="Notas adicionales..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleConfirm} disabled={isPending}>
                                {isPending ? "Procesando..." : "Registrar Pago"}
                            </Button>
                        </DialogFooter>
                    </>
                )}

                <ReceiptPortal />
            </DialogContent>
        </Dialog>
    )
}
