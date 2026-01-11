import Image from "next/image"
import { formatCurrency } from "@/lib/utils"

interface InvoiceTemplateProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoice: any
    settings?: {
        companyName: string
        companyRnc: string
        companyPhone: string
        companyAddress: string
    }
}

export function InvoiceTemplate({ invoice, settings }: InvoiceTemplateProps) {
    const companyName = settings?.companyName || "FacturaDO"
    const companyRnc = settings?.companyRnc || "101-00000-0"
    const companyAddress = settings?.companyAddress || "Av. Winston Churchill #101"
    const companyPhone = settings?.companyPhone || "809-555-0101"

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
                <Image src="/logo.png" alt="Logo" width={44} height={44} className="h-11 mx-auto mb-2" unoptimized />
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
                    {invoice.items.map((item: any) => (
                        <tr key={item.id}>
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
