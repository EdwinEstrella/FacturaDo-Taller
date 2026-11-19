import { createServerClient } from "@/lib/insforge/client"
import { PaymentDialog } from "@/components/modules/receivables/payment-dialog"
import { PaymentHistoryDialog } from "@/components/modules/receivables/payment-history-dialog"
import { computeBatchInvoiceBalances } from "@/lib/receivables/invoice-balance"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"

export default async function ReceivablesPage() {
    const insforge = createServerClient()

    const { data: invoices } = await insforge.database
        .from('Invoice')
        .select(`
            *,
            client:Client(*)
        `)
        .eq('status', 'PENDING')
        .order('createdAt', { ascending: false })

    const rawInvoices = invoices || []
    const balancesMap = await computeBatchInvoiceBalances(
        rawInvoices.map((inv) => ({ id: inv.id, total: Number(inv.total) })),
        { insforge }
    )

    const serializedInvoices = rawInvoices.map((inv) => {
        const derived = balancesMap.get(inv.id)
        return {
            ...inv,
            total: Number(inv.total),
            balance: derived ? derived.balance : Number(inv.balance || 0),
            tax: Number(inv.tax),
            shippingCost: Number(inv.shippingCost),
        }
    })

    return (
        <div className="flex-1 space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">Cuentas por Cobrar</h2>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Factura</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Teléfono</TableHead>
                            <TableHead className="text-right">Monto Pendiente</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {serializedInvoices.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center">
                                    No hay cuentas por cobrar
                                </TableCell>
                            </TableRow>
                        )}
                        {serializedInvoices.map((inv) => (
                            <TableRow key={inv.id}>
                                <TableCell>#{inv.sequenceNumber}</TableCell>
                                <TableCell>{inv.clientName}</TableCell>
                                <TableCell>{inv.client?.phone || "-"}</TableCell>
                                <TableCell className="text-right font-bold text-red-500">
                                    {formatCurrency(inv.balance)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <PaymentHistoryDialog
                                            invoice={{
                                                id: inv.id,
                                                sequenceNumber: inv.sequenceNumber,
                                                clientName: inv.clientName,
                                                total: inv.total,
                                            }}
                                        />
                                        <PaymentDialog invoice={inv} />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
