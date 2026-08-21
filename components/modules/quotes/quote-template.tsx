import { formatCurrency, formatQuantity } from "@/lib/utils"
import { getMeasurementModeFromProduct, getMeasurementShortLabel } from "@/lib/product-measurements"
import { normalizeStorageObjectUrl } from "@/lib/insforge/storage-url"

const quoteDateFormatter = new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
})

const quoteTimeFormatter = new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
})

function formatQuoteDate(date: Date | string) {
    return quoteDateFormatter.format(new Date(date))
}

function formatQuoteTime(date: Date | string) {
    return quoteTimeFormatter.format(new Date(date))
}

interface QuoteTemplateProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quote: any
    settings?: {
        companyName: string
        companyRnc: string
        companyPhone: string
        companyAddress: string
        companyLogo?: string
    }
}

export function QuoteTemplate({ quote, settings }: QuoteTemplateProps) {
    const companyName = settings?.companyName || "FacturaDO"
    const companyRnc = settings?.companyRnc || "101-00000-0"
    const companyAddress = settings?.companyAddress || "Av. Winston Churchill #101"
    const companyPhone = settings?.companyPhone || "809-555-0101"
    const logoSrc = normalizeStorageObjectUrl(settings?.companyLogo) || "/logo.png"

    const subtotal = quote.items.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (acc: number, item: any) => acc + Number(item.price) * item.quantity,
        0
    )
    const tax = Number(quote.tax ?? 0)
    const discount = Number(quote.discount ?? 0)
    const shipping = Number(quote.shippingCost ?? 0)
    const total = Number(quote.total ?? subtotal + tax + shipping - discount)
    const quoteNumber = quote.sequenceNumber
        ? `#${String(quote.sequenceNumber).padStart(6, "0")}`
        : `#${String(quote.id ?? "").slice(-8).toUpperCase()}`

    const statusLabel = quote.isDraft
        ? "Borrador"
        : quote.status === "ACCEPTED"
            ? "Aceptada"
            : quote.status === "REJECTED"
                ? "Rechazada"
                : quote.status === "EXPIRED"
                    ? "Vencida"
                    : "Pendiente"

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
                <p><strong>Cotización:</strong> {quoteNumber}</p>
                <p><strong>Fecha:</strong> {formatQuoteDate(quote.createdAt)} {formatQuoteTime(quote.createdAt)}</p>
                {quote.validUntil && <p><strong>Válida hasta:</strong> {formatQuoteDate(quote.validUntil)}</p>}
                <p><strong>Cliente:</strong> {quote.client?.name || quote.clientName || "Cliente"}</p>
                {(quote.client?.rnc || quote.client?.cedula) && <p><strong>RNC/Céd:</strong> {quote.client?.rnc || quote.client?.cedula}</p>}
                <p><strong>Estado:</strong> {statusLabel}</p>
                <p className="text-[10px] mt-1 italic">Documento no fiscal — no consume NCF</p>
                {quote.createdBy && <p className="text-[10px] italic">Atendido por: {quote.createdBy.name}</p>}
            </div>

            <div className="border-b border-dashed border-black mb-2"></div>

            <div className="mb-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {quote.items.map((item: any, index: number) => (
                    <div key={item.id} className="mb-3 pb-2 border-b border-dashed border-gray-300">
                        <div className="text-xs mb-1">ITEM #{index + 1}</div>
                        <div className="font-semibold text-sm mb-1 leading-tight">
                            {item.productName}
                        </div>
                        {item.characteristics?.map((characteristic: { label: string; value: string }, characteristicIndex: number) => (
                            <div key={characteristicIndex} className="text-xs">
                                {characteristic.label}: {characteristic.value}
                            </div>
                        ))}
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
                {(quote.applyTax || tax > 0) && (
                    <div className="flex justify-between text-red-600">
                        <span>ITBIS:</span>
                        <span>{formatCurrency(tax)}</span>
                    </div>
                )}
                {discount > 0 && (
                    <div className="flex justify-between">
                        <span>Discount:</span>
                        <span>-{formatCurrency(discount)}</span>
                    </div>
                )}
                {shipping > 0 && (
                    <div className="flex justify-between">
                        <span>Envío:</span>
                        <span>{formatCurrency(shipping)}</span>
                    </div>
                )}
            </div>

            <div className="flex justify-between font-bold text-lg border-t border-dashed border-black mt-2 pt-2">
                <span>TOTAL:</span>
                <span>{formatCurrency(total)}</span>
            </div>

            {quote.notes && (
                <div className="border-t border-dashed border-black mt-3 pt-2 text-xs">
                    <p><strong>Notas:</strong> {quote.notes}</p>
                </div>
            )}

            <div className="text-xs text-center mt-4 mb-4">
                <p className="font-semibold">Cotización informativa</p>
                <p>No afecta contabilidad ni genera NCF</p>
                <p>Gracias por su preferencia</p>
            </div>
        </div>
    )
}
