import { formatDate } from "date-fns"
import { formatCurrency } from "@/lib/utils"

interface InvoiceTemplateProps {
    invoice: any // Typed as any to avoid deep relation typing issues for now, or define a proper interface
}

export function InvoiceTemplate({ invoice }: InvoiceTemplateProps) {
    return (
        <div className="font-mono text-sm w-[80mm] p-2 bg-white text-black mx-auto">
            <style>{`
                @media print {
                    @page { margin: 0; size: 80mm auto; }
                    body { width: 80mm; }
                }
            `}</style>

            <div className="text-center mb-4">
                <h1 className="font-bold text-lg uppercase">FacturaDO</h1>
                <p>RNC: 101-00000-0</p>
                <p>Av. Winston Churchill #101</p>
                <p>Tel: 809-555-0101</p>
            </div>

            <div className="border-b border-dashed border-black mb-2"></div>

            <div className="mb-2">
                <p><strong>Factura:</strong> #{invoice.sequenceNumber}</p>
                <p><strong>Fecha:</strong> {new Date(invoice.createdAt).toLocaleDateString()} {new Date(invoice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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

            <div className="text-xs text-center mt-4 mb-4">
                <p>Gracias por su compra!</p>
                <p>Factura Generada por FacturaDO</p>
            </div>
        </div>
    )
}
