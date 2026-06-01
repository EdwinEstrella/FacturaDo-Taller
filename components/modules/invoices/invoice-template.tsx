import { formatCurrency } from "@/lib/utils"
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
        <div className="font-mono text-sm w-[80mm] p-2 bg-white text-black mx-auto">
            <style>{`
                @media print {
                    @page { margin: 0; size: 80mm auto; }
                    body { width: 80mm; }
                }
            `}</style>

            <div className="text-center mb-4">
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
                <p><strong>Tipo:</strong> {invoice.ncfType || "Consumo"}</p>
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
                                <span className="font-medium">x{item.quantity}</span>
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

            <div className="flex justify-between font-bold text-lg">
                <span>TOTAL:</span>
                <span>{formatCurrency(Number(invoice.total))}</span>
            </div>

            {invoice.shippingCost > 0 && (
                <div className="flex justify-between text-xs mt-1">
                    <span>Envío:</span>
                    <span>{formatCurrency(Number(invoice.shippingCost))}</span>
                </div>
            )}

            {/* Payment Details */}
            <div className="border-t border-dashed border-black my-2"></div>
            <div className="text-right space-y-1">
                <div className="flex justify-between">
                    <span>Estado:</span>
                    <span className="font-bold">{invoice.status === 'PAID' ? 'PAGADO' : 'PENDIENTE'}</span>
                </div>
                {invoice.status === 'PENDIENTE' && (
                    <>
                        <div className="flex justify-between">
                            <span>Abonado:</span>
                            <span>{formatCurrency(Number(invoice.total) - Number(invoice.balance))}</span>
                        </div>
                        <div className="flex justify-between font-bold text-base mt-2">
                            <span>RESTA:</span>
                            <span>{formatCurrency(Number(invoice.balance))}</span>
                        </div>
                    </>
                )}
            </div>

            <div className="text-xs text-center mt-4 mb-4">
                <p>Gracias por su compra!</p>
                <p>Factura Generada por FacturaDO</p>
            </div>
        </div>
    )
}
