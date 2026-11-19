import { formatCurrency } from "@/lib/utils"
import { normalizeStorageObjectUrl } from "@/lib/insforge/storage-url"
import { formatPaymentMethod } from "@/lib/payment-methods"
import type { CompanySettings } from "@/actions/settings-actions"

export interface PaymentReceiptItem {
    id: string
    amount: number
    method: string
    reference?: string | null
    notes?: string | null
    date: string | Date
}

export interface PaymentReceiptInvoice {
    id: string
    sequenceNumber: number
    createdAt: string | Date
    clientName: string
    total: number
}

export interface PaymentReceiptData {
    invoice: PaymentReceiptInvoice
    payments: PaymentReceiptItem[]
    paymentId: string
    totalPaid: number
    balance: number
    credited?: number
    settings?: CompanySettings
}

interface PaymentReceiptTemplateProps {
    receipt: PaymentReceiptData
}

export function PaymentReceiptTemplate({ receipt }: PaymentReceiptTemplateProps) {
    const { invoice, payments, paymentId, totalPaid, balance, credited = 0, settings } = receipt

    const companyName = settings?.companyName || "FacturaDO"
    const companyRnc = settings?.companyRnc || "101-00000-0"
    const companyAddress = settings?.companyAddress || "Av. Winston Churchill #101"
    const companyPhone = settings?.companyPhone || "809-555-0101"
    const logoSrc = normalizeStorageObjectUrl(settings?.companyLogo) || "/logo.png"

    const currentPayment = payments.find((p) => p.id === paymentId)

    // Helper for Santo Domingo timezone date
    const formatDate = (date: Date | string) => {
        if (!date) return ""
        const d = new Date(date)
        return new Intl.DateTimeFormat("es-DO", {
            timeZone: "America/Santo_Domingo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(d)
    }

    const formatTime = (date: Date | string) => {
        if (!date) return ""
        const d = new Date(date)
        return new Intl.DateTimeFormat("es-DO", {
            timeZone: "America/Santo_Domingo",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        }).format(d)
    }

    const receiptDate = currentPayment?.date || new Date()

    return (
        <div className="font-mono text-sm w-[80mm] p-2 bg-white text-black mx-auto relative overflow-hidden">
            <style>{`
                @media print {
                    @page { margin: 0; size: 80mm auto; }
                    body { width: 80mm; }
                }
            `}</style>

            {/* Business Header */}
            <div className="text-center mb-3 relative z-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} alt="Logo" className="h-11 max-w-20 object-contain mx-auto mb-2" />
                <h1 className="font-bold text-lg uppercase leading-tight">{companyName}</h1>
                {companyRnc && <p className="text-xs">RNC: {companyRnc}</p>}
                {companyAddress && <p className="text-xs">{companyAddress}</p>}
                {companyPhone && <p className="text-xs">Tel: {companyPhone}</p>}
            </div>

            <div className="border-b border-dashed border-black mb-2"></div>

            {/* Title */}
            <div className="text-center mb-2">
                <h2 className="font-bold text-base uppercase tracking-wider">RECIBO DE PAGO / ABONO</h2>
            </div>

            <div className="border-b border-dashed border-black mb-2"></div>

            {/* Receipt and Invoice Details */}
            <div className="mb-2 space-y-0.5 text-xs">
                <p>
                    <strong>Fecha Recibo:</strong> {formatDate(receiptDate)} {formatTime(receiptDate)}
                </p>
                <p>
                    <strong>Factura:</strong> #{invoice.sequenceNumber}
                </p>
                <p>
                    <strong>Fecha Factura:</strong> {formatDate(invoice.createdAt)}
                </p>
                <p>
                    <strong>Cliente:</strong> {invoice.clientName || "Consumidor Final"}
                </p>
                <p>
                    <strong>Total Factura:</strong> {formatCurrency(Number(invoice.total))}
                </p>
            </div>

            <div className="border-b border-dashed border-black mb-2"></div>

            {/* List of all payments on this invoice */}
            <div className="mb-2">
                <div className="font-bold text-xs uppercase mb-1.5">Historial de Abonos</div>
                <div className="space-y-1.5 text-xs">
                    {payments.map((p) => {
                        const isCurrent = p.id === paymentId
                        return (
                            <div
                                key={p.id}
                                className={`flex justify-between items-start ${
                                    isCurrent ? "font-bold" : ""
                                }`}
                            >
                                <div className="text-left pr-1">
                                    <div>
                                        <span>
                                            {p.date ? formatDate(p.date) : ""} - {formatPaymentMethod(p.method)}
                                        </span>
                                        {isCurrent && (
                                            <span className="ml-1 text-[11px] font-bold uppercase text-black">
                                                ← este abono
                                            </span>
                                        )}
                                    </div>
                                    {p.reference && (
                                        <span className="block text-[11px] text-gray-600 font-normal">
                                            Ref: {p.reference}
                                        </span>
                                    )}
                                    {p.notes && (
                                        <span className="block text-[11px] text-gray-500 italic font-normal">
                                            {p.notes}
                                        </span>
                                    )}
                                </div>
                                <span className="shrink-0">{formatCurrency(Number(p.amount))}</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="border-b border-dashed border-black mb-2"></div>

            {/* Summary / Totals */}
            <div className="space-y-1 text-xs">
                {currentPayment && (
                    <div className="flex justify-between font-bold text-sm">
                        <span>Monto de este abono:</span>
                        <span>{formatCurrency(Number(currentPayment.amount))}</span>
                    </div>
                )}
                {credited > 0 && (
                    <div className="flex justify-between text-gray-600">
                        <span>Notas de crédito:</span>
                        <span>-{formatCurrency(credited)}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span>Total abonado:</span>
                    <span className="font-medium">{formatCurrency(totalPaid)}</span>
                </div>
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            {/* Prominent Pending Balance (RESTA) */}
            <div className="flex justify-between font-bold text-base py-1">
                <span>RESTA:</span>
                <span>{balance <= 0.01 ? "SALDADO" : formatCurrency(balance)}</span>
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            {/* Footer */}
            <div className="text-xs text-center mt-3 mb-2">
                <p>¡Gracias por su pago!</p>
                <p className="text-[10px] text-gray-500">Documento Generado por FacturaDO</p>
            </div>
        </div>
    )
}
