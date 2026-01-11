import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { revalidatePath } from "next/cache"
import { formatCurrency } from "@/lib/utils"

export default async function PettyCashPage({ searchParams }: { searchParams: { q?: string } }) {
    const query = searchParams?.q ?? ""

    const transactions = await prisma.transaction.findMany({
        where: {
            type: 'EXPENSE',
            category: 'PETTY_CASH',
            ...(query
                ? {
                    OR: [
                        { description: { contains: query, mode: 'insensitive' } },
                    ],
                }
                : {}),
        },
        orderBy: { date: 'desc' },
    })

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Caja Chica</h2>

            <div className="flex flex-col gap-4 border p-4 rounded-lg bg-gray-50">
                <form className="flex gap-4 w-full items-end" action={""}>
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="search">Buscar</Label>
                        <Input
                            id="search"
                            name="q"
                            placeholder="Buscar por descripción..."
                            defaultValue={query}
                        />
                    </div>
                    <Button type="submit" variant="outline">Filtrar</Button>
                </form>

                <form action={async (formData) => {
                    "use server"
                    const amount = parseFloat(formData.get("amount") as string)
                    const description = formData.get("description") as string

                    await prisma.transaction.create({
                        data: {
                            type: 'EXPENSE',
                            category: 'PETTY_CASH',
                            amount,
                            description
                        }
                    })
                    revalidatePath("/petty-cash")
                }} className="flex gap-4 w-full items-end">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="description">Descripción</Label>
                        <Input name="description" placeholder="Compra de café..." required />
                    </div>
                    <div className="grid w-full max-w-xs items-center gap-1.5">
                        <Label htmlFor="amount">Monto</Label>
                        <Input name="amount" type="number" placeholder="0.00" required />
                    </div>
                    <Button type="submit" variant="destructive">Registrar Gasto</Button>
                </form>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map((t) => (
                            <TableRow key={t.id}>
                                <TableCell>{t.date.toLocaleDateString()}</TableCell>
                                <TableCell>{t.description}</TableCell>
                                <TableCell className="text-right font-bold text-red-500">-{formatCurrency(Number(t.amount))}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
