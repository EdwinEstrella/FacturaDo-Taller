import Image from "next/image"
import { formatCurrency } from "@/lib/utils"

interface QuoteItem {
    id: string
    productName: string
    price: number
    quantity: number
}

interface Quote {
    id: string
    createdAt: Date | string
    status: string
    total: number
    validUntil?: Date | string | null
    client?: {
        name?: string
        rnc?: string | null
        cedula?: string | null
        address?: string | null
        phone?: string | null
        email?: string | null
    } | null
    createdBy?: {
        name: string
    } | null
    items: QuoteItem[]
}

interface CompanySettings {
    companyName: string
    companyRnc: string
    companyPhone: string
    companyAddress: string
    companyLogo?: string
}

interface QuoteTemplateProps {
    quote: Quote
    settings?: CompanySettings
}

export function QuoteTemplate({ quote, settings }: QuoteTemplateProps) {
    const companyName = settings?.companyName || "FacturaDO"
    const companyRnc = settings?.companyRnc || "101-00000-0"
    const companyAddress = settings?.companyAddress || "Av. Winston Churchill #101"
    const companyPhone = settings?.companyPhone || "809-555-0101"
    const logoSrc = settings?.companyLogo && settings.companyLogo.length > 0 ? settings.companyLogo : "/logo.png"

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
                <Image src={logoSrc} alt="Logo" width={44} height={44} className="h-11 mx-auto mb-2" unoptimized />
                <h1 className="font-bold text-lg uppercase">{companyName}</h1>
                <p>RNC: {companyRnc}</p>
                <p>{companyAddress}</p>
                <p>Tel: {companyPhone}</p>
            </div>

            <div className="border-b border-dashed border-black mb-2"></div>

            <div className="mb-2">
                <p><strong>COTIZACIÓN</strong></p>
                <p><strong>Fecha:</strong> {formatDate(quote.createdAt)} {formatTime(quote.createdAt)}</p>
                {quote.validUntil && <p><strong>Vence:</strong> {formatDate(quote.validUntil)}</p>}
                <p><strong>Cliente:</strong> {quote.client?.name || "Cliente"}</p>
                {quote.client?.rnc && <p><strong>RNC/Ced:</strong> {quote.client.rnc}</p>}
                <p><strong>Estado:</strong> {quote.status === "PENDING" ? "Pendiente" : quote.status === "EXPIRED" ? "Vencida" : quote.status}</p>
                {quote.createdBy && <p className="text-[10px] mt-1 italic">Atendido por: {quote.createdBy.name}</p>}
            </div>

            <div className="border-b border-dashed border-black mb-2"></div>

            <div className="mb-2">
                {quote.items.map((item: QuoteItem, index: number) => (
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
                <span>{formatCurrency(Number(quote.total))}</span>
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            <div className="text-xs text-center mt-4 mb-4">
                <p className="font-semibold">Válida por 15 días</p>
                <p>Gracias por su preferencia!</p>
                <p>Cotización generada por FacturaDO</p>
            </div>
        </div>
    )
}
