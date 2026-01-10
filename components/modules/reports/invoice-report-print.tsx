"use client"

import { Invoice } from "@prisma/client"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency } from "@/lib/utils"

interface InvoiceReportPrintProps {
    invoices: (Invoice & { client?: { name: string } })[]
    stats: {
        count: number
        total: number
        paid: number
        pending: number
    }
    filters?: {
        startDate?: string
        endDate?: string
        minAmount?: string
        maxAmount?: string
        period?: string
    }
}

export function InvoiceReportPrint({ invoices, stats, filters }: InvoiceReportPrintProps) {
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
                <img src="/logo.png" alt="Logo" className="h-11 mx-auto mb-2" />
                <h1 className="text-2xl font-bold uppercase">Reporte de Facturas</h1>
                <p className="text-gray-600 mt-1">Reporte detallado de ventas y facturación</p>
                <p className="text-xs text-gray-500 mt-2">
                    Fecha de impresión: {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}
                </p>
                {filters && (filters.startDate || filters.endDate || filters.minAmount || filters.period) && (
                    <div className="mt-2 text-xs text-gray-600">
                        <strong>Filtros aplicados:</strong>
                        {filters.period && <span> Periodo: {filters.period}</span>}
                        {filters.startDate && <span> Desde: {filters.startDate}</span>}
                        {filters.endDate && <span> Hasta: {filters.endDate}</span>}
                        {filters.minAmount && <span> Monto mínimo: {filters.minAmount}</span>}
                        {filters.maxAmount && <span> Monto máximo: {filters.maxAmount}</span>}
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded border border-blue-200">
                    <p className="text-2xl font-bold text-blue-600">{stats.count}</p>
                    <p className="text-xs text-gray-600">Total Facturas</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded border border-green-200">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.total)}</p>
                    <p className="text-xs text-gray-600">Monto Total</p>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded border border-emerald-200">
                    <p className="text-2xl font-bold text-emerald-600">{stats.paid}</p>
                    <p className="text-xs text-gray-600">Pagadas</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded border border-orange-200">
                    <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
                    <p className="text-xs text-gray-600">Pendientes</p>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse border border-black mb-8 text-xs">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border border-black p-2 text-left">#</th>
                        <th className="border border-black p-2 text-left">Fecha</th>
                        <th className="border border-black p-2 text-left">Cliente</th>
                        <th className="border border-black p-2 text-left">Estado</th>
                        <th className="border border-black p-2 text-right">Monto</th>
                        <th className="border border-black p-2 text-center">NCF</th>
                    </tr>
                </thead>
                <tbody>
                    {invoices.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="border border-black p-4 text-center">
                                No hay facturas que coincidan con los filtros
                            </td>
                        </tr>
                    ) : (
                        invoices.map((invoice, index) => (
                            <tr key={invoice.id}>
                                <td className="border border-black p-2">{invoice.sequenceNumber}</td>
                                <td className="border border-black p-2">
                                    {format(new Date(invoice.createdAt), "dd/MM/yyyy", { locale: es })}
                                </td>
                                <td className="border border-black p-2">
                                    {invoice.client?.name || invoice.clientName || "Consumidor Final"}
                                </td>
                                <td className="border border-black p-2 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        invoice.status === 'PAID'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-orange-100 text-orange-700'
                                    }`}>
                                        {invoice.status === 'PAID' ? 'PAGADA' : 'PENDIENTE'}
                                    </span>
                                </td>
                                <td className="border border-black p-2 text-right font-bold">
                                    {formatCurrency(Number(invoice.total))}
                                </td>
                                <td className="border border-black p-2 text-center text-xs">
                                    {invoice.ncf || "-"}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
                {invoices.length > 0 && (
                    <tfoot>
                        <tr className="bg-gray-100 font-bold">
                            <td colSpan={4} className="border border-black p-2 text-right">
                                TOTALES:
                            </td>
                            <td className="border border-black p-2 text-right text-lg">
                                {formatCurrency(stats.total)}
                            </td>
                            <td className="border border-black p-2 text-center">
                                {stats.count}
                            </td>
                        </tr>
                    </tfoot>
                )}
            </table>

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 mt-8 pt-4 border-t">
                <p>Generado por FacturaDO - Sistema de Facturación</p>
            </div>
        </div>
    )
}
