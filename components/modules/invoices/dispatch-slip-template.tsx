import Image from "next/image"
import type { InvoiceItem, Client } from "@/types"
import { formatQuantity } from "@/lib/utils"
import { getMeasurementShortLabel } from "@/lib/product-measurements"

interface DispatchSlipTemplateProps {
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

export function DispatchSlipTemplate({ invoice, settings }: DispatchSlipTemplateProps) {
    const companyName = settings?.companyName || "FacturaDO"
    
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
                        <Image src="/logo.png" alt="Logo" width={56} height={56} className="h-14 w-auto" unoptimized />
                        <div>
                            <h1 className="text-2xl font-bold uppercase">{companyName}</h1>
                            <h2 className="text-xl font-bold mt-1">Conduce de Entrega / Despacho</h2>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-lg">Factura Ref: #{invoice.sequenceNumber}</p>
                        <p>Fecha: {invoice.createdAt ? formatDate(invoice.createdAt) : "No disponible"}</p>
                    </div>
                </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="border p-4">
                    <h3 className="font-bold border-b mb-2">Datos del Cliente</h3>
                    <p>{invoice.clientName || invoice.client?.name || "Consumidor Final"}</p>
                    {(invoice.client?.phone) && <p>Tel: {invoice.client.phone}</p>}
                    {(invoice.client?.address) && <p>Dirección: {invoice.client.address}</p>}
                </div>
                <div className="border p-4">
                    <h3 className="font-bold border-b mb-2">Información de Entrega</h3>
                    {invoice.dispatchInfo?.technician ? (
                        <p>Despachador: {invoice.dispatchInfo.technician.name}</p>
                    ) : (
                        <p className="text-gray-500 italic">Sin despachador asignado</p>
                    )}
                    {invoice.notes && (
                        <div className="mt-2 text-xs">
                            <span className="font-bold">Notas:</span> {invoice.notes}
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-6">
                <h3 className="font-bold text-lg mb-2">Artículos Despachados</h3>
                <table className="w-full border-collapse border border-black">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="border border-black p-2 text-center w-12">#</th>
                            <th className="border border-black p-2 text-left">Descripción del Artículo</th>
                            <th className="border border-black p-2 text-center w-24">Cant.</th>
                            <th className="border border-black p-2 text-center w-24">Check</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {invoice.items.map((item: any, index: number) => {
                            let measurement = ""
                            if (item.unitType === "UNIT" || !item.unitType) {
                                measurement = "u"
                            } else if (item.measurementUnit) {
                                measurement = getMeasurementShortLabel(item.measurementUnit) || item.measurementUnit
                            }

                            return (
                                <tr key={item.id}>
                                    <td className="border border-black p-2 text-center">{index + 1}</td>
                                    <td className="border border-black p-2">
                                        <div className="font-medium">{item.productName}</div>
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {item.characteristics?.map((char: any, i: number) => (
                                            <div key={i} className="text-xs text-gray-600">
                                                - {char.label}: {char.value}
                                            </div>
                                        ))}
                                    </td>
                                    <td className="border border-black p-2 text-center font-bold">
                                        {formatQuantity(item.quantity)} {measurement}
                                    </td>
                                    <td className="border border-black p-2"></td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-16 flex justify-between text-center">
                <div className="border-t border-black w-5/12 pt-2">
                    <p className="font-bold">Despachado por (Firma)</p>
                    <p className="text-xs text-gray-600 mt-1">Nombre y Fecha</p>
                </div>
                <div className="border-t border-black w-5/12 pt-2">
                    <p className="font-bold">Recibido Conforme (Firma)</p>
                    <p className="text-xs text-gray-600 mt-1">Nombre, Cédula y Fecha</p>
                </div>
            </div>
            
            <div className="mt-8 text-center text-xs text-gray-500">
                Este documento es comprobante de la entrega de los artículos facturados. No es válido como factura fiscal.
            </div>
        </div>
    )
}
