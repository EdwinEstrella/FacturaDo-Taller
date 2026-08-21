import { formatCurrency, formatQuantity } from "@/lib/utils"
import { getMeasurementModeFromProduct, getMeasurementShortLabel } from "@/lib/product-measurements"
import { calculateDerivedInvoiceDiscount, calculateInvoiceSubtotal } from "@/lib/invoice-totals"
import { normalizeStorageObjectUrl } from "@/lib/insforge/storage-url"

interface InvoiceTemplateProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoice: any
    settings?: {
        companyName: string
        companyRnc: string
        companyPhone: string
        companyAddress: string
        companyLogo?: string
    }
}

export function InvoiceTemplate({ invoice, settings }: InvoiceTemplateProps) {
    const companyName = settings?.companyName || "FacturaDO"
    const companyRnc = settings?.companyRnc || "101-00000-0"
    const companyAddress = settings?.companyAddress || "Av. Winston Churchill #101"
    const companyPhone = settings?.companyPhone || "809-555-0101"
    const logoSrc = normalizeStorageObjectUrl(settings?.companyLogo) || "/logo.png"
    const subtotal = calculateInvoiceSubtotal(invoice.items || [])
    const tax = Number(invoice.tax || 0)
    const shipping = Number(invoice.shippingCost || 0)
    const discount = calculateDerivedInvoiceDiscount(invoice)
    const total = Number(invoice.total ?? subtotal + tax + shipping - discount)
    const balance = Number(invoice.balance || 0)
    const fiscalType = invoice.ncf?.startsWith("B01") ? "Crédito Fiscal" : (invoice.ncfType || "Consumo")

    // Helper for Santo Domingo timezone date
    const formatDate = (date: Date | string) => {
        const d = new Date(date)
        return new Intl.DateTimeFormat("es-DO", {
            timeZone: "America/Santo_Domingo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(d)
    }

    const formatTime = (date: Date | string) => {
        const d = new Date(date)
        return new Intl.DateTimeFormat("es-DO", {
            timeZone: "America/Santo_Domingo",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        }).format(d)
    }

    return (
        <div className="font-mono text-sm w-[80mm] p-2 bg-white text-black mx-auto relative overflow-hidden">
            <style>{`
                @media print {
                    @page { margin: 0; size: 80mm auto; }
                    body { width: 80mm; }
                    .watermark {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>

            {invoice.status === 'PAID' && (
                <div className="watermark absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0" style={{ opacity: 0.6, marginTop: '2rem' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/pagado.png" alt="Sello Pagado" className="w-[180px] object-contain mix-blend-multiply" />
                </div>
            )}

            <div className="text-center mb-4 relative z-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} alt="Logo" className="h-11 max-w-20 object-contain mx-auto mb-2" />
                <h1 className="font-bold text-lg uppercase">{companyName}</h1>
                <p>RNC: {companyRnc}</p>
                <p>{companyAddress}</p>
                <p>Tel: {companyPhone}</p>
            </div>

            <div className="border-b border-dashed border-black mb-2"></div>

            <div className="mb-2">
                <p><strong>Factura:</strong> #{invoice.sequenceNumber}</p>
                <p><strong>Fecha:</strong> {formatDate(invoice.createdAt)} {formatTime(invoice.createdAt)}</p>
                <p><strong>Cliente:</strong> {invoice.clientName || "Consumidor Final"}</p>
                {invoice.client?.rnc && <p><strong>RNC/Ced:</strong> {invoice.client.rnc}</p>}
                <p><strong>Tipo:</strong> {fiscalType}</p>
                {invoice.ncf && <p><strong>NCF:</strong> {invoice.ncf}</p>}
                {invoice.createdBy && <p className="text-[10px] mt-1 italic">Atendido por: {invoice.createdBy.name}</p>}
                {invoice.dispatchInfo?.technician && <p className="text-[10px] italic">Despachado por: {invoice.dispatchInfo.technician.name}</p>}
            </div>

            <div className="border-b border-dashed border-black mb-2"></div>

            <div className="mb-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {invoice.items.map((item: any, index: number) => (
                    <div key={item.id} className="mb-3 pb-2 border-b border-dashed border-gray-300">
                        <div className="text-xs mb-1">ITEM #{index + 1}</div>
                        <div className="font-semibold text-sm mb-1 leading-tight">
                            {item.productName}
                        </div>
                        <div className="text-xs mt-1 space-y-1">
                            <div className="flex justify-between">
                                <span>Precio Unit:</span>
                                <span className="font-medium">{formatCurrency(Number(item.price))}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Cantidad:</span>
                                <span className="font-medium">x{formatQuantity(item.quantity)} {getMeasurementShortLabel(getMeasurementModeFromProduct(item))}</span>
                            </div>
                            <div className="flex justify-between font-bold text-base">
                                <span>Subtotal:</span>
                                <span>{formatCurrency(Number(item.price) * item.quantity)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-b border-dashed border-black mb-2"></div>

            <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                    <div className="flex justify-between">
                        <span>Discount:</span>
                        <span>-{formatCurrency(discount)}</span>
                    </div>
                )}
                {tax > 0 && (
                    <div className="flex justify-between">
                        <span>ITBIS:</span>
                        <span>{formatCurrency(tax)}</span>
                    </div>
                )}
                {shipping > 0 && (
                    <div className="flex justify-between">
                        <span>Envío:</span>
                        <span>{formatCurrency(shipping)}</span>
                    </div>
                )}
            </div>

            <div className="flex justify-between font-bold text-lg mt-2">
                <span>TOTAL:</span>
                <span>{formatCurrency(total)}</span>
            </div>

            {/* Payment Details */}
            <div className="border-t border-dashed border-black my-2"></div>
            <div className="text-right space-y-1">
                <div className="flex justify-between">
                    <span>Estado:</span>
                    <span className="font-bold">{invoice.status === 'PAID' ? 'PAGADO' : 'PENDIENTE'}</span>
                </div>
                {invoice.status === 'PENDING' && (
                    <>
                        <div className="flex justify-between">
                            <span>Abonado:</span>
                            <span>{formatCurrency(total - balance)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-base mt-2">
                            <span>RESTA:</span>
                            <span>{formatCurrency(balance)}</span>
                        </div>
                    </>
                )}
            </div>

            {invoice.notes && (
                <div className="border-t border-dashed border-black my-2 pt-2 text-xs">
                    <div className="font-bold">Notes:</div>
                    <div className="whitespace-pre-line">{invoice.notes}</div>
                </div>
            )}

            <div className="text-xs text-center mt-4 mb-4">
                <p>Gracias por su compra!</p>
                <p>Factura Generada por FacturaDO</p>
            </div>
        </div>
    )
}
