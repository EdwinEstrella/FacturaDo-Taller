"use client"

import { Client } from "@prisma/client"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface ClientReportPrintProps {
    clients: Client[]
    filters?: {
        name?: string
        rnc?: string
        startDate?: string
        endDate?: string
    }
}

export function ClientReportPrint({ clients, filters }: ClientReportPrintProps) {
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
                <img src="/logo.png" alt="Logo" className="h-16 mx-auto mb-2" />
                <h1 className="text-2xl font-bold uppercase">Reporte de Clientes</h1>
                <p className="text-gray-600 mt-1">Listado completo de clientes registrados</p>
                <p className="text-xs text-gray-500 mt-2">
                    Fecha de impresión: {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}
                </p>
                {filters && (filters.name || filters.rnc || filters.startDate) && (
                    <div className="mt-2 text-xs text-gray-600">
                        <strong>Filtros aplicados:</strong>
                        {filters.name && <span> Nombre: {filters.name}</span>}
                        {filters.rnc && <span> RNC: {filters.rnc}</span>}
                        {filters.startDate && <span> Desde: {filters.startDate}</span>}
                        {filters.endDate && <span> Hasta: {filters.endDate}</span>}
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded border">
                    <p className="text-2xl font-bold text-blue-600">{clients.length}</p>
                    <p className="text-xs text-gray-600">Total Clientes</p>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse border border-black mb-8">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border border-black p-2 text-left">#</th>
                        <th className="border border-black p-2 text-left">Nombre</th>
                        <th className="border border-black p-2 text-left">RNC/Cédula</th>
                        <th className="border border-black p-2 text-left">Teléfono</th>
                        <th className="border border-black p-2 text-left">Email</th>
                        <th className="border border-black p-2 text-left">Fecha Registro</th>
                    </tr>
                </thead>
                <tbody>
                    {clients.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="border border-black p-4 text-center">
                                No hay clientes que coincidan con los filtros
                            </td>
                        </tr>
                    ) : (
                        clients.map((client, index) => (
                            <tr key={client.id}>
                                <td className="border border-black p-2">{index + 1}</td>
                                <td className="border border-black p-2 font-medium">{client.name}</td>
                                <td className="border border-black p-2">{client.rnc || "-"}</td>
                                <td className="border border-black p-2">{client.phone || "-"}</td>
                                <td className="border border-black p-2">{client.email || "-"}</td>
                                <td className="border border-black p-2">
                                    {format(new Date(client.createdAt), "dd/MM/yyyy", { locale: es })}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 mt-8 pt-4 border-t">
                <p>Generado por FacturaDO - Sistema de Facturación</p>
            </div>
        </div>
    )
}
