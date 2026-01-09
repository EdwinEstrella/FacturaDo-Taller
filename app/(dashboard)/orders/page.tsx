import { getWorkOrders, updateWorkOrderStatus } from "@/actions/order-actions"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
// import { format } from "date-fns" // Client side
import Link from "next/link"
import { Printer, ArrowRight, CheckCircle } from "lucide-react"

export default async function OrdersPage() {
    const orders = await getWorkOrders()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Pedidos & Producción</h2>

            <div className="grid gap-4 md:grid-cols-3">
                {/* Summary Cards could go here */}
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Orden #</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Notas / Medidas</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No hay pedidos pendientes</TableCell></TableRow>}
                        {orders.map((order) => (
                            <TableRow key={order.id}>
                                <TableCell className="font-mono">#{order.id}</TableCell>
                                <TableCell>{order.invoice.clientName || order.invoice.client?.name}</TableCell>
                                <TableCell>
                                    <Badge variant={order.status === "PRODUCTION" ? "destructive" : (order.status === "READY" ? "default" : "secondary")}>
                                        {order.status === "PRODUCTION" && "En Producción"}
                                        {order.status === "READY" && "Listo para Entrega"}
                                        {order.status === "COMPLETED" && "Entregado"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="max-w-xs truncate" title={order.notes || ""}>{order.notes || "-"}</TableCell>
                                <TableCell className="text-right flex justify-end gap-2">
                                    <Link href={`/invoices/${order.invoiceId}/work-order/print`} target="_blank">
                                        <Button variant="ghost" size="icon" title="Imprimir Conduce de Trabajo">
                                            <Printer className="h-4 w-4" />
                                        </Button>
                                    </Link>

                                    {order.status === "PRODUCTION" && (
                                        <form action={async () => {
                                            "use server"
                                            await updateWorkOrderStatus(order.id, "READY")
                                        }}>
                                            <Button size="sm" variant="outline" title="Marcar Listo">
                                                <ArrowRight className="h-4 w-4 mr-2" /> Listo
                                            </Button>
                                        </form>
                                    )}

                                    {order.status === "READY" && (
                                        <form action={async () => {
                                            "use server"
                                            await updateWorkOrderStatus(order.id, "COMPLETED")
                                        }}>
                                            <Button size="sm" variant="outline" title="Marcar Entregado">
                                                <CheckCircle className="h-4 w-4 mr-2" /> Entregado
                                            </Button>
                                        </form>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
