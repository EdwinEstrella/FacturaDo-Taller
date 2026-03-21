import { getQuoteById } from "@/actions/quote-actions"
import { getCompanySettings } from "@/actions/settings-actions"
import { notFound } from "next/navigation"

export default async function PrintQuotePage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const quote = await getQuoteById(id)
    const settings = await getCompanySettings()

    if (!quote) return notFound()

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center print:bg-white print:items-start print:justify-start p-8">
            <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-2xl print:shadow-none print:rounded-none print:p-0">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold">{settings.companyName || "Mi Empresa"}</h1>
                    {settings.address && <p className="text-sm text-gray-600">{settings.address}</p>}
                    {settings.phone && <p className="text-sm text-gray-600">Tel: {settings.phone}</p>}
                    {settings.email && <p className="text-sm text-gray-600">{settings.email}</p>}
                    {settings.rnc && <p className="text-sm text-gray-600">RNC: {settings.rnc}</p>}
                </div>

                <hr className="my-4" />

                {/* Quote Info */}
                <div className="flex justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold">Cotización</h2>
                        <p className="text-sm text-gray-600">Fecha: {new Date(quote.createdAt).toLocaleDateString('es-DO')}</p>
                        <p className="text-sm text-gray-600">Estado: {quote.status === "PENDING" ? "Pendiente" : quote.status}</p>
                    </div>
                </div>

                {/* Client Info */}
                <div className="mb-6">
                    <h3 className="font-bold mb-2">Cliente:</h3>
                    <p className="text-sm">{quote.client?.name || "Cliente"}</p>
                    {quote.client?.rnc && <p className="text-sm text-gray-600">RNC/Cédula: {quote.client.rnc}</p>}
                    {quote.client?.address && <p className="text-sm text-gray-600">Dirección: {quote.client.address}</p>}
                    {quote.client?.phone && <p className="text-sm text-gray-600">Teléfono: {quote.client.phone}</p>}
                </div>

                {/* Items Table */}
                <table className="w-full mb-6">
                    <thead>
                        <tr className="border-b-2 border-gray-300">
                            <th className="text-left py-2">Descripción</th>
                            <th className="text-center py-2">Cant.</th>
                            <th className="text-right py-2">Precio</th>
                            <th className="text-right py-2">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quote.items.map((item, index) => (
                            <tr key={index} className="border-b border-gray-200">
                                <td className="py-2">{item.productName}</td>
                                <td className="text-center py-2">{item.quantity}</td>
                                <td className="text-right py-2">RD${item.price.toFixed(2)}</td>
                                <td className="text-right py-2">RD${(item.quantity * item.price).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Total */}
                <div className="flex justify-end">
                    <div className="text-right">
                        <p className="text-xl font-bold">Total: RD${quote.total.toFixed(2)}</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-4 border-t text-center text-sm text-gray-600">
                    <p>Esta cotización es válida por 15 días</p>
                    <p>Gracias por su preferencia</p>
                </div>

                {quote.createdBy && (
                    <p className="text-sm text-gray-600 mt-4">Atendido por: {quote.createdBy.name}</p>
                )}
            </div>
            <script dangerouslySetInnerHTML={{ __html: 'window.print();' }} />
        </div>
    )
}