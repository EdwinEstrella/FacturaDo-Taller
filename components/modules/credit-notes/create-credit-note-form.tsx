"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { createCreditNote } from "@/actions/credit-note-actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

// Define types based on what we expect from the invoice
interface InvoiceItem {
    id: string
    productId: string
    productName: string
    quantity: number
    price: number
}

interface Invoice {
    id: string
    sequenceNumber: number
    clientName: string | null
    total: number
    items: InvoiceItem[]
    createdAt: Date
}

interface CreateCreditNoteFormProps {
    invoices: Invoice[] // Passed from server
}

export function CreateCreditNoteForm({ invoices }: CreateCreditNoteFormProps) {
    const [openInvoice, setOpenInvoice] = useState(false)
    const [selectedInvoiceId, setSelectedInvoiceId] = useState("")
    const [reason, setReason] = useState("")
    const [restoreStock, setRestoreStock] = useState(true)
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({}) // productId -> quantity to return

    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId)

    const toggleItem = (productId: string, maxQty: number) => {
        setSelectedItems(prev => {
            if (prev[productId]) {
                const copy = { ...prev }
                delete copy[productId]
                return copy
            }
            return { ...prev, [productId]: maxQty } // Default to full quantity
        })
    }

    const updateItemQuantity = (productId: string, qty: number, maxQty: number) => {
        if (qty < 1) return
        if (qty > maxQty) qty = maxQty
        setSelectedItems(prev => ({ ...prev, [productId]: qty }))
    }

    const selectedTotal = selectedInvoice ? selectedInvoice.items.reduce((acc, item) => {
        const qty = selectedItems[item.productId] || 0
        return acc + (item.price * qty)
    }, 0) : 0

    const handleSubmit = () => {
        if (!selectedInvoice) return toast.error("Seleccione una factura")
        if (!reason) return toast.error("Ingrese una razón")

        const itemsToReturn = selectedInvoice.items
            .filter(item => selectedItems[item.productId])
            .map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: selectedItems[item.productId], // Verified not undefined by filter
                price: item.price
            }))

        if (itemsToReturn.length === 0) return toast.error("Seleccione al menos un producto")

        startTransition(async () => {
            const res = await createCreditNote({
                invoiceId: selectedInvoice.id,
                reason,
                items: itemsToReturn,
                restoreStock
            })

            if (res.success) {
                toast.success("Nota de Crédito Creada")
                router.push("/credit-notes")
                router.refresh()
            } else {
                toast.error("Error: " + res.error)
            }
        })
    }

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Detalles de la Nota</CardTitle>
                    <CardDescription>Seleccione la factura afectada</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">Factura</label>
                        <Popover open={openInvoice} onOpenChange={setOpenInvoice}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openInvoice}
                                    className="w-full justify-between"
                                >
                                    {selectedInvoiceId
                                        ? `Factura #${invoices.find((inv) => inv.id === selectedInvoiceId)?.sequenceNumber} - ${invoices.find((inv) => inv.id === selectedInvoiceId)?.clientName}`
                                        : "Buscar factura..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                                <Command>
                                    <CommandInput placeholder="Buscar por # o cliente..." />
                                    <CommandEmpty>No encontrada.</CommandEmpty>
                                    <CommandGroup>
                                        {invoices.map((inv) => (
                                            <CommandItem
                                                key={inv.id}
                                                value={`#${inv.sequenceNumber} ${inv.clientName || ""}`}
                                                onSelect={() => {
                                                    setSelectedInvoiceId(inv.id)
                                                    setOpenInvoice(false)
                                                    setSelectedItems({}) // Reset items
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        selectedInvoiceId === inv.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <div className="flex flex-col">
                                                    <span>Factura #{inv.sequenceNumber}</span>
                                                    <span className="text-xs text-muted-foreground">{inv.clientName} - {formatCurrency(Number(inv.total))}</span>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Razón / Motivo</label>
                        <Textarea
                            placeholder="Ej: Devolución de mercancía, Error en precio..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="restore"
                            checked={restoreStock}
                            onCheckedChange={(c) => setRestoreStock(!!c)}
                        />
                        <label
                            htmlFor="restore"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Devolver artículos al inventario (Restaurar Stock)
                        </label>
                    </div>
                </CardContent>
            </Card>

            {selectedInvoice && (
                <Card>
                    <CardHeader>
                        <CardTitle>Selección de Productos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">Devolver</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Cant. Facturada</TableHead>
                                    <TableHead className="text-right">Cant. a Devolver</TableHead>
                                    <TableHead className="text-right">Precio</TableHead>
                                    <TableHead className="text-right">Subtotal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedInvoice.items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={!!selectedItems[item.productId]}
                                                onCheckedChange={() => toggleItem(item.productId, item.quantity)}
                                            />
                                        </TableCell>
                                        <TableCell>{item.productName}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">
                                            {selectedItems[item.productId] ? (
                                                <Input
                                                    type="number"
                                                    className="w-20 ml-auto h-8"
                                                    value={selectedItems[item.productId]}
                                                    onChange={(e) => updateItemQuantity(item.productId, parseInt(e.target.value), item.quantity)}
                                                    min={1}
                                                    max={item.quantity}
                                                />
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            {selectedItems[item.productId]
                                                ? formatCurrency(item.price * selectedItems[item.productId])
                                                : "-"}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t pt-6">
                        <div className="text-lg font-bold">
                            Total a Devolver: {formatCurrency(selectedTotal)}
                        </div>
                        <Button onClick={handleSubmit} disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Crear Nota de Crédito
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    )
}
