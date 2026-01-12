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
import { formatCurrency } from "@/lib/utils"
import { formatDateTimeDO } from "@/lib/date-utils"
import { Printer } from "lucide-react"
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
                                <TableCell className="text-right">
                                    <Link href={`/credit-notes/${cn.id}/print`} target="_blank">
                                        <Button variant="ghost" size="icon" title="Imprimir">
                                            <Printer className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
