import { prisma } from "@/lib/prisma"
import { markAsPaid } from "@/actions/invoice-actions"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { CheckCircle2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default async function ReceivablesPage() {
    const invoices = await prisma.invoice.findMany({
        where: {
            status: 'PENDING', // Assuming PENDING means Unpaid/Credit
        },
        include: { client: true },
        orderBy: { createdAt: 'desc' }
    })

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
                        {invoices.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No hay cuentas por cobrar</TableCell></TableRow>}
                        {invoices.map((inv) => (
                            <TableRow key={inv.id}>
                                <TableCell>#{inv.sequenceNumber}</TableCell>
                                <TableCell>{inv.clientName}</TableCell>
                                <TableCell>{inv.client?.phone || "-"}</TableCell>
                                <TableCell className="text-right font-bold text-red-500">{formatCurrency(Number(inv.total))}</TableCell>
                                <TableCell className="text-right">
                                    <form action={async () => {
                                        "use server"
                                        await markAsPaid(inv.id)
                                    }}>
                                        <Button size="sm" variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
                                            <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar Pagado
                                        </Button>
                                    </form>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
