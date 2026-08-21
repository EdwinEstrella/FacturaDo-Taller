"use client"

import { useState, useEffect } from "react"
import { getInvoices } from "@/actions/invoice-actions"
import { filterInvoices, getInvoiceStats } from "@/actions/filter-actions"
import { getCurrentUser } from "@/actions/auth-actions"
import { getCompanySettings, type CompanySettings } from "@/actions/settings-actions"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { InvoiceFilters } from "@/components/modules/invoices/invoice-filters"
import { InvoiceReportPrint } from "@/components/modules/reports/invoice-report-print"
import { CreateWorkOrderDialog } from "@/components/modules/orders/create-order-dialog"
import { InvoicePreviewDialog } from "@/components/modules/invoices/invoice-preview"
import { WorkOrderPreviewDialog } from "@/components/modules/orders/work-order-preview"
import { DeleteInvoiceDialog } from "@/components/modules/invoices/delete-invoice-dialog"
import { Pencil } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { formatDateTimeDO } from "@/lib/date-utils"
import Link from "next/link"
import { PageLoading } from "@/components/ui/loading"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvoiceType = any

export default function InvoicesPage() {
    const [filteredInvoices, setFilteredInvoices] = useState<InvoiceType[]>([])
    const [stats, setStats] = useState({ count: 0, total: 0, paid: 0, pending: 0 })
    const [user, setUser] = useState<{ role: string } | null>(null)
    const [settings, setSettings] = useState<CompanySettings | null>(null)
    const [showPrint, setShowPrint] = useState(false)
    const [loading, setLoading] = useState(true)
    const [currentFilters, setCurrentFilters] = useState<Record<string, string>>({})

    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            try {
                const [invoicesData, userData, settingsData] = await Promise.all([
                    getInvoices(),
                    getCurrentUser(),
                    getCompanySettings()
                ])
                setFilteredInvoices(invoicesData)
                setUser(userData)
                setSettings(settingsData)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    const handleFilter = async (filters: {
        startDate?: string
        endDate?: string
        minAmount?: string
        maxAmount?: string
        period?: string
        status?: 'PAID' | 'PENDING' | 'CANCELLED'
    }) => {
        setCurrentFilters(filters)
        const filtered = await filterInvoices({
            startDate: filters.startDate ? new Date(filters.startDate) : undefined,
            endDate: filters.endDate ? new Date(filters.endDate) : undefined,
            minAmount: filters.minAmount ? parseFloat(filters.minAmount) : undefined,
            maxAmount: filters.maxAmount ? parseFloat(filters.maxAmount) : undefined,
            period: filters.period as 'today' | 'week' | 'month' | 'year' | undefined,
            status: filters.status,
        })
        setFilteredInvoices(filtered)

        const statsData = await getInvoiceStats({
            startDate: filters.startDate ? new Date(filters.startDate) : undefined,
            endDate: filters.endDate ? new Date(filters.endDate) : undefined,
            minAmount: filters.minAmount ? parseFloat(filters.minAmount) : undefined,
            maxAmount: filters.maxAmount ? parseFloat(filters.maxAmount) : undefined,
            period: filters.period as 'today' | 'week' | 'month' | 'year' | undefined,
            status: filters.status,
        })
        setStats(statsData)
    }

    const handlePrint = () => {
        setShowPrint(true)
        setTimeout(() => {
            window.print()
            setShowPrint(false)
        }, 100)
    }



    // ... existing imports

    if (loading) {
        return <PageLoading message="Cargando facturas..." />
    }

    const isAdmin = user?.role === 'ADMIN'

    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Facturación</h2>
                    <div className="flex gap-2">
                        <Link href="/invoices/create?type=INVOICE">
                            <Button>Nueva Factura</Button>
                        </Link>
                    </div>
                </div>

                <div className="space-y-4">
                    <InvoiceFilters onFilter={handleFilter} onPrint={handlePrint} />

                    {/* Stats Summary */}
                    {(currentFilters.startDate || currentFilters.endDate || currentFilters.period || currentFilters.minAmount || currentFilters.maxAmount || currentFilters.status) && (
                        <div className="grid grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg border">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-blue-600">{stats.count}</p>
                                <p className="text-xs text-gray-600">Facturas</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.total)}</p>
                                <p className="text-xs text-gray-600">Total</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-emerald-600">{stats.paid}</p>
                                <p className="text-xs text-gray-600">Pagadas</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
                                <p className="text-xs text-gray-600">Pendientes</p>
                            </div>
                        </div>
                    )}

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>No.</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredInvoices.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center">No hay facturas</TableCell>
                                    </TableRow>
                                )}
                                {filteredInvoices.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-mono">#{invoice.sequenceNumber}</TableCell>
                                        <TableCell>{formatDateTimeDO(invoice.createdAt)}</TableCell>
                                        <TableCell>{invoice.clientName || invoice.client?.name || "Consumidor Final"}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                invoice.status === "PAID" ? "bg-green-100 text-green-800" :
                                                invoice.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                                                "bg-gray-100 text-gray-800"
                                            }`}>
                                                {invoice.status === "PAID" ? "Pagado" : invoice.status === "PENDING" ? "Pendiente" : invoice.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(Number(invoice.total))}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {isAdmin && (
                                                    <Link href={`/invoices/${invoice.id}/edit`}>
                                                        <Button variant="ghost" size="icon" title="Editar Factura">
                                                            <Pencil className="h-4 w-4 text-blue-500" />
                                                        </Button>
                                                    </Link>
                                                )}

                                                <InvoicePreviewDialog invoice={invoice} settings={settings || undefined} />

                                                {invoice.workOrder && (
                                                    <WorkOrderPreviewDialog invoice={invoice} />
                                                )}

                                                {!invoice.workOrder && (
                                                    <CreateWorkOrderDialog invoiceId={invoice.id} />
                                                )}

                                                {isAdmin && (
                                                    <DeleteInvoiceDialog
                                                        invoiceId={invoice.id}
                                                        isProduction={!!invoice.workOrder}
                                                    />
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {showPrint && (
                <div className="fixed inset-0 z-50 bg-white overflow-auto">
                    <InvoiceReportPrint invoices={filteredInvoices} stats={stats} filters={currentFilters} />
                </div>
            )}
        </>
    )
}
