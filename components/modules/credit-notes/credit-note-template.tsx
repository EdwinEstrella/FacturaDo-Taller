import Image from "next/image"
import { formatCurrency } from "@/lib/utils"

interface CreditNoteTemplateProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    creditNote: any
    settings?: {
        companyName: string
        companyRnc: string
        companyPhone: string
        companyAddress: string
        companyLogo?: string
    }
}

export function CreditNoteTemplate({ creditNote, settings }: CreditNoteTemplateProps) {
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

    // Items are stored as JSON in creditNote.items
    const items = Array.isArray(creditNote.items) ? creditNote.items : JSON.parse(creditNote.items as string || "[]")

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

            <div className="text-center mb-2">
                <h2 className="font-bold text-base">NOTA DE CRÉDITO</h2>
                <p>#{creditNote.sequenceNumber}</p>
            </div>

            <div className="mb-2">
                <p><strong>Fecha:</strong> {formatDate(creditNote.createdAt)} {formatTime(creditNote.createdAt)}</p>
                <p><strong>Afecta Factura:</strong> #{creditNote.invoice?.sequenceNumber}</p>
                <p><strong>Cliente:</strong> {creditNote.invoice?.client?.name || creditNote.invoice?.clientName || "Consumidor Final"}</p>
                {creditNote.invoice?.client?.rnc && <p><strong>RNC/Ced:</strong> {creditNote.invoice.client.rnc}</p>}
                <p><strong>Razón:</strong> {creditNote.reason}</p>
            </div>

            <div className="border-b border-dashed border-black mb-2"></div>

            <table className="w-full mb-2 text-left">
                <thead>
                    <tr>
                        <th className="w-1/2">Desc</th>
                        <th className="w-1/4 text-right">Cant</th>
                        <th className="w-1/4 text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {items.map((item: any, idx: number) => (
                        <tr key={idx}>
                            <td colSpan={3} className="pt-1">
                                {item.productName}
                                <div className="flex justify-between text-xs">
                                    <span>{formatCurrency(Number(item.price))} x {item.quantity}</span>
                                    <span className="font-bold">{formatCurrency(Number(item.price) * item.quantity)}</span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="border-b border-dashed border-black mb-2"></div>

            <div className="flex justify-between font-bold text-lg">
                <span>TOTAL DEVUELTO:</span>
                <span>{formatCurrency(Number(creditNote.total))}</span>
            </div>

            <div className="text-xs text-center mt-4 mb-4">
                <p>Documento generado por FacturaDO</p>
            </div>
        </div>
    )
}
