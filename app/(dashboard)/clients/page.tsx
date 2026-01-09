import { getClients } from "@/actions/client-actions"
import { ClientDialog } from "@/components/modules/clients/client-dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"

export default async function ClientsPage() {
    const clients = await getClients()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
                <div className="flex items-center space-x-2">
                    <ClientDialog />
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>RNC/Cédula</TableHead>
                            <TableHead>Teléfono</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Dirección</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {clients.map((client) => (
                            <TableRow key={client.id}>
                                <TableCell className="font-medium">{client.name}</TableCell>
                                <TableCell>{client.rnc}</TableCell>
                                <TableCell>{client.phone}</TableCell>
                                <TableCell>{client.email}</TableCell>
                                <TableCell>{client.address}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm">Editar</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
