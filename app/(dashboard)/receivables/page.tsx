import { prisma } from "@/lib/prisma"
// import { markAsPaid } from "@/actions/invoice-actions" // Unused
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
    const invoices = await prisma.invoice.findMany({
        where: {
            status: 'PENDING', // Assuming PENDING means Unpaid/Credit
        },
        include: { client: true },
        orderBy: { createdAt: 'desc' }
    })

    // Serialize Decimal to number for client component
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serializedInvoices = invoices.map((inv: any) => ({
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
