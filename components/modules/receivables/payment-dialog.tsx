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
import { registerPayment } from "@/actions/receivables-actions"
import { toast } from "sonner"
import { DollarSign } from "lucide-react"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PaymentDialog({ invoice }: { invoice: any }) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    const balance = Number(invoice.balance || invoice.total) // Fallback for old invoices?
    const [amount, setAmount] = useState(balance)
    const [method, setMethod] = useState("CASH")
    const [reference, setReference] = useState("")
    const [notes, setNotes] = useState("")
    const [date, setDate] = useState<Date | undefined>(new Date())

    const handleConfirm = () => {
        if (!amount || amount <= 0) return toast.error("Monto inválido")
        if (amount > balance + 0.01) return toast.error("El monto excede el balance")

        startTransition(async () => {
            const res = await registerPayment({
                invoiceId: invoice.id,
                amount,
                method,
                reference,
                notes,
                date
            })

            if (res.success) {
                toast.success("Pago registrado correctamente")
                setOpen(false)
            } else {
                toast.error("Error: " + res.error)
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
                    <DollarSign className="mr-2 h-4 w-4" />
                    Registrar Abono
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Registrar Pago / Abono</DialogTitle>
                    <DialogDescription>
                        Factura #{invoice.sequenceNumber} - Balance: <span className="font-bold text-red-600">{formatCurrency(balance)}</span>
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
                            <SelectContent>
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
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleConfirm} disabled={isPending}>
                        {isPending ? "Procesando..." : "Registrar Pago"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
