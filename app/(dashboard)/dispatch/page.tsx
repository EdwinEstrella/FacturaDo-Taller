import { prisma } from "@/lib/prisma"
import { markAsDispatched } from "@/actions/invoice-actions"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Truck } from "lucide-react"

export default async function DispatchPage() {
    const invoices = await prisma.invoice.findMany({
        where: {
            status: 'PAID',
            dispatched: false
        },
        include: { client: true },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Despacho / Conduce</h2>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Factura</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Dirección</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No hay despachos pendientes</TableCell></TableRow>}
                        {invoices.map((inv) => (
                            <TableRow key={inv.id}>
                                <TableCell>#{inv.sequenceNumber}</TableCell>
                                <TableCell>{inv.clientName}</TableCell>
                                <TableCell>{inv.client?.address || "N/A"}</TableCell>
                                <TableCell className="text-right">
                                    <form action={async () => {
                                        "use server"
                                        await markAsDispatched(inv.id)
                                    }}>
                                        <Button size="sm">
                                            <Truck className="mr-2 h-4 w-4" /> Despachar
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
