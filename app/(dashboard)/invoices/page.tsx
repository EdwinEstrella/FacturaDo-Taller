import { getInvoices } from "@/actions/invoice-actions"
import { getQuotes } from "@/actions/quote-actions"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs" // Server component issue? Shadcn tabs are client mostly
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QuoteList } from "@/components/modules/quotes/quote-list"
import Link from "next/link"
// import { Printer, FileText } from "lucide-react"
import { CreateWorkOrderDialog } from "@/components/modules/orders/create-order-dialog"
import { InvoicePreviewDialog } from "@/components/modules/invoices/invoice-preview"
import { WorkOrderPreviewDialog } from "@/components/modules/orders/work-order-preview"
import { DeleteInvoiceDialog } from "@/components/modules/invoices/delete-invoice-dialog"

export default async function InvoicesPage() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoices: any[] = await getInvoices()
    const quotes = await getQuotes()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Facturación & Cotizaciones</h2>
                <div className="flex gap-2">
                    <Link href="/invoices/create?type=QUOTE">
                        <Button variant="outline" className="border-yellow-500 text-yellow-600 hover:bg-yellow-50">Nueva Cotización</Button>
                    </Link>
                    <Link href="/invoices/create?type=INVOICE">
                        <Button>Nueva Factura</Button>
                    </Link>
                </div>
            </div>

            <Tabs defaultValue="invoices" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="invoices">Facturas</TabsTrigger>
                    <TabsTrigger value="quotes">Cotizaciones</TabsTrigger>
                </TabsList>
                <TabsContent value="invoices" className="space-y-4">
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
                                {invoices.length === 0 && <TableRow><TableCell colSpan={6} className="text-center">No hay facturas</TableCell></TableRow>}
                                {invoices.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-mono">#{invoice.sequenceNumber}</TableCell>
                                        <TableCell>{new Date(invoice.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell>{invoice.clientName || invoice.client?.name || "Consumidor Final"}</TableCell>
                                        <TableCell>{invoice.status}</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(Number(invoice.total))}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {/* Invoice Print Preview */}
                                                <InvoicePreviewDialog invoice={invoice} />

                                                {/* Work Order Preview (if exists) */}
                                                {invoice.workOrder && (
                                                    <WorkOrderPreviewDialog invoice={invoice} />
                                                )}

                                                {!invoice.workOrder && (
                                                    <CreateWorkOrderDialog invoiceId={invoice.id} />
                                                )}

                                                <DeleteInvoiceDialog
                                                    invoiceId={invoice.id}
                                                    isProduction={!!invoice.workOrder}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
                <TabsContent value="quotes" className="space-y-4">
                    <QuoteList quotes={quotes} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
