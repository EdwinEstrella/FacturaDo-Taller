"use client"

import Image from "next/image"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { MapPin, Package, Phone, User } from "lucide-react"

interface DispatchReportPrintProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dispatches: any[]
}

export function DispatchReportPrint({ dispatches }: DispatchReportPrintProps) {
    return (
        <div className="font-sans text-sm w-[210mm] p-8 bg-white text-black mx-auto">
            <style>{`
                @media print {
                    @page { margin: 10mm; size: A4 portrait; }
                    body { width: 210mm; }
                    .no-print { display: none; }
                }
            `}</style>

            {/* Header */}
            <div className="text-center mb-8 border-b-2 border-black pb-4">
                <Image src="/logo.png" alt="Logo" width={44} height={44} className="h-11 mx-auto mb-2" unoptimized />
                <h1 className="text-2xl font-bold uppercase">Reporte de Despachos</h1>
                <p className="text-gray-600 mt-1">Listado de entregas e instalaciones</p>
                <p className="text-xs text-gray-500 mt-2">
                    Fecha de impresión: {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}
                </p>
            </div>

            {/* Resumen */}
            <div className="mb-6 grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-yellow-50 rounded border">
                    <p className="text-2xl font-bold text-yellow-600">
                        {dispatches.filter((d) => d.status === 'PENDING').length}
                    </p>
                    <p className="text-xs text-gray-600">Pendientes</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded border">
                    <p className="text-2xl font-bold text-blue-600">
                        {dispatches.filter((d) => d.status === 'IN_PROGRESS').length}
                    </p>
                    <p className="text-xs text-gray-600">En Progreso</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded border">
                    <p className="text-2xl font-bold text-green-600">
                        {dispatches.filter((d) => d.status === 'DELIVERED').length}
                    </p>
                    <p className="text-xs text-gray-600">Entregados</p>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded border">
                    <p className="text-2xl font-bold text-emerald-600">
                        {dispatches.filter((d) => d.status === 'INSTALLED').length}
                    </p>
                    <p className="text-xs text-gray-600">Instalados</p>
                </div>
            </div>

            {/* Lista de Despachos */}
            {dispatches.map((dispatch) => {
                const invoice = dispatch.invoice
                const client = invoice?.client
                const items = invoice?.items || []

                return (
                    <div key={dispatch.id} className="mb-8 p-4 border-2 border-gray-300 rounded-lg">
                        {/* Encabezado del despacho */}
                        <div className="flex justify-between items-start mb-4 border-b pb-2">
                            <div>
                                <h3 className="text-lg font-bold">
                                    Orden #{invoice?.sequenceNumber}
                                </h3>
                                <p className="text-xs text-gray-500">
                                    ID Despacho: {dispatch.id}
                                </p>
                            </div>
                            <div className="text-right">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    dispatch.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                    dispatch.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                    dispatch.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                                    dispatch.status === 'INSTALLED' ? 'bg-emerald-100 text-emerald-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                    {dispatch.status === 'PENDING' ? 'PENDIENTE' :
                                     dispatch.status === 'IN_PROGRESS' ? 'EN PROGRESO' :
                                     dispatch.status === 'DELIVERED' ? 'ENTREGADO' :
                                     dispatch.status === 'INSTALLED' ? 'INSTALADO' :
                                     dispatch.status}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Información del Cliente */}
                            <div className="space-y-3">
                                <div>
                                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                                        <User className="h-4 w-4" />
                                        Cliente
                                    </h4>
                                    <div className="bg-gray-50 p-3 rounded text-sm">
                                        <p className="font-bold">{client?.name || invoice?.clientName}</p>
                                        {client?.phone && (
                                            <p className="flex items-center gap-1 text-gray-600">
                                                <Phone className="h-3 w-3" />
                                                {client.phone}
                                            </p>
                                        )}
                                        {client?.address && (
                                            <p className="flex items-start gap-1 text-gray-600">
                                                <MapPin className="h-3 w-3 mt-0.5" />
                                                {client.address}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {dispatch.technician && (
                                    <div>
                                        <h4 className="font-semibold mb-2">Técnico Asignado</h4>
                                        <p className="text-sm bg-blue-50 p-2 rounded inline-block">
                                            {dispatch.technician.name}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Items a Entregar */}
                            <div>
                                <h4 className="font-semibold flex items-center gap-2 mb-2">
                                    <Package className="h-4 w-4" />
                                    Items a Entregar/Instalar
                                </h4>
                                <div className="bg-gray-50 p-3 rounded">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-1">Producto</th>
                                                <th className="text-center py-1">Cant.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item) => (
                                                <tr key={item.id} className="border-b last:border-0">
                                                    <td className="py-1">{item.productName}</td>
                                                    <td className="text-center py-1">{item.quantity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Notas y Fechas */}
                        <div className="mt-4 pt-3 border-t text-sm space-y-1">
                            {dispatch.notes && (
                                <p>
                                    <span className="font-semibold">Notas:</span> {dispatch.notes}
                                </p>
                            )}
                            <div className="flex gap-4 text-xs text-gray-500">
                                <p>Creado: {format(new Date(dispatch.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                                {dispatch.deliveredAt && (
                                    <p>Entregado: {format(new Date(dispatch.deliveredAt), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                                )}
                                {dispatch.installedAt && (
                                    <p>Instalado: {format(new Date(dispatch.installedAt), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                                )}
                            </div>
                            {dispatch.photos && dispatch.photos.length > 0 && (
                                <p className="text-blue-600">
                                    ✓ {dispatch.photos.length} foto{dispatch.photos.length !== 1 ? 's' : ''} adjunta{dispatch.photos.length !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                    </div>
                )
            })}

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 mt-8 pt-4 border-t">
                <p>Generado por FacturaDO - Sistema de Facturación</p>
            </div>
        </div>
    )
}
