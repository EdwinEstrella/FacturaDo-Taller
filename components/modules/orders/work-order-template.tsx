import type { Invoice, InvoiceItem } from "@/types"

interface WorkOrder {
    id: string
    status: string
    notes?: string | null
    createdAt: Date
    updatedAt: Date
}

interface InvoiceWithWorkOrder extends Invoice {
    workOrder: WorkOrder
    clientName?: string | null
    sequenceNumber?: string | null
}

interface WorkOrderTemplateProps {
    invoice: InvoiceWithWorkOrder
}

export function WorkOrderTemplate({ invoice }: WorkOrderTemplateProps) {
    if (!invoice?.workOrder) return null

    return (
        <div className="font-mono text-sm w-full max-w-[210mm] mx-auto p-4 bg-white text-black">
            <style>{`
                @media print {
                    @page { size: auto; margin: 10mm; }
                }
            `}</style>

            <div className="border-b-2 border-black pb-4 mb-4">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <img src="/logo.png" alt="Logo" className="h-14 w-auto" />
                        <div>
                            <h1 className="text-2xl font-bold uppercase">Conduce de Trabajo</h1>
                            <p className="text-lg">Orden #: {invoice.workOrder.id}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold">Factura Ref: #{invoice.sequenceNumber}</p>
                        <p>Fecha: {new Date(invoice.workOrder.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="border p-4">
                    <h3 className="font-bold border-b mb-2">Cliente</h3>
                    <p>{invoice.clientName || invoice.client?.name}</p>
                    <p>{invoice.client?.phone || "-"}</p>
                </div>
                <div className="border p-4">
                    <h3 className="font-bold border-b mb-2">Estado</h3>
                    <p className="uppercase font-bold">{invoice.workOrder.status === 'PRODUCTION' ? 'EN PRODUCCIÓN' : invoice.workOrder.status}</p>
                </div>
            </div>

            <div className="mb-6">
                <h3 className="font-bold text-lg mb-2">Especificaciones / Medidas</h3>
                <div className="border p-4 bg-gray-50 min-h-[100px] whitespace-pre-wrap">
                    {invoice.workOrder.notes}
                </div>
            </div>

            <div className="mb-6">
                <h3 className="font-bold text-lg mb-2">Items Requeridos</h3>
                <table className="w-full border-collapse border border-black">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="border border-black p-2 text-left">Producto</th>
                            <th className="border border-black p-2 text-center w-20">Cant.</th>
                            <th className="border border-black p-2 text-center w-24">Check</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map((item: InvoiceItem) => (
                            <tr key={item.id}>
                                <td className="border border-black p-2">{item.productName}</td>
                                <td className="border border-black p-2 text-center">{item.quantity}</td>
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-12 flex justify-between text-center">
                <div className="border-t border-black w-1/3 pt-2">Firma Producción</div>
                <div className="border-t border-black w-1/3 pt-2">Firma Entrega</div>
            </div>
        </div>
    )
}
