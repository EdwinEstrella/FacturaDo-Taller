import { prisma } from "@/lib/prisma"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { formatCurrency, formatDateTimeDO } from "@/lib/utils"
// import { Plus } from "lucide-react"

export default async function CreditNotesPage() {
    const creditNotes = await prisma.creditNote.findMany({
        include: {
            invoice: {
                select: { sequenceNumber: true, clientName: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Notas de Crédito</h2>
                <Link href="/credit-notes/create">
                    <Button>Nueva Nota de Crédito</Button>
                </Link>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Secuencia</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Factura Afectada</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Razón</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {creditNotes.length === 0 && <TableRow><TableCell colSpan={6} className="text-center">No hay notas de crédito</TableCell></TableRow>}
                        {creditNotes.map((cn) => (
                            <TableRow key={cn.id}>
                                <TableCell>#{cn.sequenceNumber}</TableCell>
                                <TableCell>{formatDateTimeDO(cn.createdAt)}</TableCell>
                                <TableCell>#{cn.invoice.sequenceNumber}</TableCell>
                                <TableCell>{cn.invoice.clientName}</TableCell>
                                <TableCell>{cn.reason}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(Number(cn.total))}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
