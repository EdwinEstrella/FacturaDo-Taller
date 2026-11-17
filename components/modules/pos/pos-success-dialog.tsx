"use client"

import { useRef, useState } from "react"
import { CheckCircle2, Printer, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { InvoiceTemplate } from "@/components/modules/invoices/invoice-template"
import { InvoiceOdooTemplate } from "@/components/modules/invoices/invoice-odoo-template"
import { useInvoicePrint } from "@/hooks/use-invoice-print"
import { useEcfPrintData } from "@/hooks/use-ecf-print-data"
import { formatCurrency } from "@/lib/utils"
import type { CompanySettings } from "@/actions/settings-actions"
import type { PosInvoice } from "./pos-types"

interface PosSuccessDialogProps {
    isOpen: boolean
    invoice: PosInvoice | null
    completedSale?: {
        invoiceId: string
        total: number
    } | null
    settings?: CompanySettings | null
    onNewSale: () => void
}

const PAYMENT_LABELS: Record<string, string> = {
    CASH: "Efectivo",
    TRANSFER: "Transferencia",
    CARD: "Tarjeta",
    CREDIT: "Crédito",
}

export function PosSuccessDialog({
    isOpen,
    invoice,
    completedSale,
    settings,
    onNewSale,
}: PosSuccessDialogProps) {
    const contentRef = useRef<HTMLDivElement>(null)

    const initialTemplate: "ticket" | "a4-odoo" =
        settings?.invoiceTemplate === "a4" ? "a4-odoo" : "ticket"
    const [template, setTemplate] = useState<"ticket" | "a4-odoo">(initialTemplate)

    const { print } = useInvoicePrint({ contentRef, format: template })
    const { ecf, waiting } = useEcfPrintData(invoice?.id, invoice?.encf || invoice?.ncf, isOpen)

    const seqDisplay = invoice?.sequenceNumber
        ? `#${String(invoice.sequenceNumber).padStart(6, "0")}`
        : completedSale?.invoiceId
        ? `ID: ${completedSale.invoiceId.slice(0, 8)}...`
        : "Generada"
    const fiscalDisplay = invoice?.encf || invoice?.ncf || "Sin comprobante fiscal"
    const clientDisplay = invoice?.client?.name || invoice?.clientName || "Consumidor Final"
    const paymentDisplay = invoice?.paymentMethod
        ? PAYMENT_LABELS[invoice.paymentMethod] || invoice.paymentMethod
        : "Registrado"
    const totalAmount = invoice ? Number(invoice.total || 0) : (completedSale?.total || 0)

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onNewSale()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="text-center space-y-1">
                    <CheckCircle2 className="size-12 text-emerald-600 mx-auto" />
                    <DialogTitle className="text-xl font-bold text-slate-900">
                        ¡Venta Completada con Éxito!
                    </DialogTitle>
                    <p className="text-xs text-slate-500">
                        La factura ha sido registrada correctamente en el sistema.
                    </p>
                </DialogHeader>

                {/* Invoice Summary Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                        <span className="font-semibold text-slate-600">Número de Factura:</span>
                        <span className="font-bold text-slate-900 text-sm">{seqDisplay}</span>
                    </div>

                    {invoice && (
                        <>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Comprobante (NCF):</span>
                                <span className={`font-mono font-semibold ${
                                    invoice.encf || invoice.ncf ? "text-blue-600" : "text-slate-500"
                                }`}>
                                    {fiscalDisplay}
                                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Cliente:</span>
                                <span className="font-medium text-slate-800 truncate max-w-[200px]">
                                    {clientDisplay}
                                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Método de Pago:</span>
                                <span className="font-medium text-slate-800">{paymentDisplay}</span>
                            </div>
                        </>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                        <span className="text-sm font-bold text-slate-800">Total Cobrado:</span>
                        <span className="text-base font-black text-emerald-600">
                            {formatCurrency(totalAmount)}
                        </span>
                    </div>
                </div>

                {waiting && (
                    <div className="p-2.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-xs text-center font-medium">
                        Firmando el comprobante electrónico y enviándolo a la DGII...
                    </div>
                )}
                {ecf?.state === "rejected" && (
                    <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs text-center font-medium">
                        La DGII rechazó el comprobante: {ecf.message}
                    </div>
                )}

                {!invoice && (
                    <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs text-center font-medium">
                        No se pudo cargar la factura para imprimir; imprímala desde Facturas.
                    </div>
                )}

                {/* Print Format Selector */}
                {invoice && (
                    <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-500">Formato de impresión:</span>
                        <Select value={template} onValueChange={(v) => setTemplate(v as "ticket" | "a4-odoo")}>
                            <SelectTrigger className="w-[180px] h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ticket">Ticket 80mm (térmica)</SelectItem>
                                <SelectItem value="a4-odoo">Factura A4</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={print}
                        disabled={!invoice || waiting}
                        className="h-11 font-semibold flex items-center justify-center gap-2 border-slate-300 disabled:opacity-50"
                    >
                        <Printer className="size-4" />
                        {waiting ? "Firmando..." : "Imprimir"}
                    </Button>
                    <Button
                        type="button"
                        onClick={onNewSale}
                        className="h-11 font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                    >
                        <Plus className="size-4" />
                        Nueva Venta
                    </Button>
                </div>

                {/* Hidden container for print extraction and rendering */}
                {invoice && (
                    <div className="hidden">
                        <div ref={contentRef}>
                            {template === "ticket" ? (
                                <InvoiceTemplate invoice={invoice} settings={settings || undefined} ecf={ecf} />
                            ) : (
                                <InvoiceOdooTemplate invoice={invoice} settings={settings || undefined} ecf={ecf} />
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
