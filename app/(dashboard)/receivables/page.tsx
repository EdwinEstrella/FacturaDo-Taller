import { createClient } from "@/lib/supabase/server"
import { PaymentDialog } from "@/components/modules/receivables/payment-dialog"
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
    const supabase = await createClient()

    const { data: invoices } = await supabase
        .from('Invoice')
        .select(`
            *,
            client:Client(*)
        `)
        .eq('status', 'PENDING')
        .order('createdAt', { ascending: false })

    const serializedInvoices = (invoices || []).map(inv => ({
        ...inv,
        total: Number(inv.total),
        balance: Number(inv.balance),
        tax: Number(inv.tax),
        shippingCost: Number(inv.shippingCost)
    }))

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight text-red-600">Cuentas por Cobrar</h2>
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
                        {serializedInvoices.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No hay cuentas por cobrar</TableCell></TableRow>}
                        {serializedInvoices.map((inv) => (
                            <TableRow key={inv.id}>
                                <TableCell>#{inv.sequenceNumber}</TableCell>
                                <TableCell>{inv.clientName}</TableCell>
                                <TableCell>{inv.client?.phone || "-"}</TableCell>
                                <TableCell className="text-right font-bold text-red-500">{formatCurrency(inv.balance)}</TableCell>
                                <TableCell className="text-right">
                                    <PaymentDialog invoice={inv} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
