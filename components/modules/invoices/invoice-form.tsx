"use client"

import { useMemo, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Check, ChevronsUpDown, Trash2, Eye } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { updateInvoice, createInvoice } from "@/actions/invoice-actions"
import { createQuote } from "@/actions/quote-actions"
import type { Client, Product } from "@prisma/client"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { DatePicker } from "@/components/ui/date-picker"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface SerializedProduct extends Omit<Product, 'price' | 'cost'> {
    price: number
    cost: number
}

interface InvoiceFormProps {
    initialProducts: SerializedProduct[] | Product[]
    initialClients: Client[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialData?: any // Optional initial data for editing
}

interface InvoiceItemState {
    productId: string
    productName: string
    price: number
    quantity: number
}

export function InvoiceForm({ initialProducts, initialClients, initialData }: InvoiceFormProps) {
    // Handling form state changes for HMR sync

    const [items, setItems] = useState<InvoiceItemState[]>(initialData?.items || [])
    const [selectedClientId, setSelectedClientId] = useState<string>(initialData?.clientId || "")
    const [isPending, startTransition] = useTransition()
    const [showPreview, setShowPreview] = useState(false)

    // New Fields State
    const [shippingCost, setShippingCost] = useState<number>(initialData?.shippingCost || 0)
    const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(initialData?.deliveryDate ? new Date(initialData.deliveryDate) : undefined)
    const [notes, setNotes] = useState<string>(initialData?.notes || "")
    const [paymentMethod, setPaymentMethod] = useState<string>(initialData?.paymentMethod || "CASH")
    const [amountTendered, setAmountTendered] = useState<number>(0)

    const searchParams = useSearchParams()
    const router = useRouter()
    // Determine type: explicitly QUOTE param, OR if we are editing an Invoice (no param usually)
    // If initialData exists, we assume we are editing whatever type passing in, but usually Invoice editing.
    const isEdit = !!initialData
    const type = searchParams.get("type") === "QUOTE" ? "QUOTE" : "INVOICE"

    // Product Search State
    const [openProduct, setOpenProduct] = useState(false)
    const [openClient, setOpenClient] = useState(false)

    const addItem = (product: SerializedProduct) => {
        setItems(prev => {
            const existing = prev.find(p => p.productId === product.id)
            if (existing) {
                return prev.map(p => p.productId === product.id ? { ...p, quantity: p.quantity + 1 } : p)
            }
            return [...prev, { productId: product.id, productName: product.name, price: Number(product.price), quantity: 1 }]
        })
        setOpenProduct(false)
    }

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(p => p.productId !== id))
    }

    const updateQuantity = (id: string, q: number) => {
        if (q < 1) return
        setItems(prev => prev.map(p => p.productId === id ? { ...p, quantity: q } : p))
    }

    const [hasNcf, setHasNcf] = useState<boolean>(initialData?.hasNcf || false)

    // Mapa de productos para saber si son servicios / exentos de ITBIS
    const productMap = useMemo(() => {
        const map = new Map<string, SerializedProduct | Product>()
        for (const p of initialProducts as SerializedProduct[]) {
            // SerializedProduct es compatible con Product en los campos que usamos
            map.set(p.id as string, p)
        }
        return map
    }, [initialProducts])

    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0)

    // Solo aplicamos ITBIS a productos que NO son servicios
    const taxableSubtotal = items.reduce((acc, item) => {
        const product = productMap.get(item.productId)
        // Se considera servicio si isService es true o la categoría es "SERVICIO"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const asAny = product as any | undefined
        const isService = asAny?.isService || asAny?.category === "SERVICIO"
        if (isService) return acc
        return acc + (item.price * item.quantity)
    }, 0)

    const taxAmount = taxableSubtotal * 0.18
    const total = subtotal + taxAmount + shippingCost
    const change = (paymentMethod === "CASH" && amountTendered > total) ? amountTendered - total : 0

    const handlePreview = () => {
        if (!selectedClientId) return toast.error("Seleccione un cliente")
        if (items.length === 0) return toast.error("Agregue productos")
        setShowPreview(true)
    }

    const handleConfirm = () => {
        setShowPreview(false)

        const selectedClient = initialClients.find(c => c.id === selectedClientId)
        if (!selectedClient) return toast.error("Cliente inválido")

        startTransition(async () => {
            let res;

            if (isEdit) {
                // Edit Mode (Always Invoice for now)
                res = await updateInvoice(initialData.id, {
                    clientId: selectedClientId,
                    clientName: selectedClient.name,
                    items,
                    total,
                    paymentMethod,
                    shippingCost,
                    deliveryDate,
                    notes,
                    tax: taxAmount,
                    hasNcf,
                })
            } else {
                // Create Mode
                if (type === "QUOTE") {
                    res = await createQuote({
                        clientId: selectedClientId,
                        items,
                        // Quote doesn't support shipping/notes yet in schema? 
                        // Wait, I didn't update Quote schema. Let's ignore new fields for Quote or just pass them if schema allowed (it doesn't).
                        // I will ignore for Quote for now as user asked for Invoice enhancements.
                    })
                } else {
                    res = await createInvoice({
                        clientId: selectedClientId,
                        clientName: selectedClient.name,
                        items,
                        total,
                        paymentMethod,
                        shippingCost,
                        deliveryDate,
                        notes,
                        amountPaid: paymentMethod === "CASH" ? amountTendered : undefined,
                        tax: taxAmount,
                        hasNcf,
                    })
                }
            }

            if (res.success) {
                toast.success(isEdit ? "Factura Actualizada" : (type === "QUOTE" ? "Cotización Creada!" : "Factura Creada!"))
                if (!isEdit) {
                    setItems([])
                    setSelectedClientId("")
                }
                router.push("/invoices")
                router.refresh()
            } else {
                toast.error("Error: " + res.error)
            }
        })
    }

    const selectedClient = initialClients.find(c => c.id === selectedClientId)

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-6">
                <Card>
                    <CardContent className="p-4 space-y-4">
                        <h3 className="font-semibold text-lg">
                            {isEdit ? "Editar Factura" : (type === "QUOTE" ? "Nueva Cotización" : "Nueva Factura")}
                        </h3>
                        {/* Only show info box if NOT editing to avoid clutter, or update text */}
                        {!isEdit && (
                            <div className="bg-yellow-100 p-2 rounded text-sm mb-2">
                                {type === "QUOTE" ? "Modo: Cotización (No afecta stock)" : "Modo: Facturación (Descuenta stock)"}
                            </div>
                        )}
                        {isEdit && (
                            <div className="bg-blue-100 p-2 rounded text-sm mb-2">
                                Modo Edición: El stock se recalculará automáticamente.
                            </div>
                        )}

                        <Popover open={openClient} onOpenChange={setOpenClient}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openClient}
                                    className="w-full justify-between"
                                >
                                    {selectedClientId
                                        ? initialClients.find((client) => client.id === selectedClientId)?.name
                                        : "Seleccionar Cliente..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                                <Command>
                                    <CommandInput placeholder="Buscar cliente por nombre o RNC..." />
                                    <CommandEmpty>Cliente no encontrado.</CommandEmpty>
                                    <CommandGroup>
                                        {initialClients.map((client) => (
                                            <CommandItem
                                                key={client.id}
                                                value={`${client.name} ${client.rnc || ""}`}
                                                onSelect={() => {
                                                    setSelectedClientId(client.id)
                                                    setOpenClient(false)
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        selectedClientId === client.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <div className="flex flex-col">
                                                    <span>{client.name}</span>
                                                    {client.rnc && <span className="text-xs text-muted-foreground">RNC: {client.rnc}</span>}
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 space-y-4">
                        <h3 className="font-semibold">Agregar Producto</h3>
                        <Popover open={openProduct} onOpenChange={setOpenProduct}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" aria-expanded={openProduct} className="w-full justify-between">
                                    Buscar producto...
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                                <Command>
                                    <CommandInput placeholder="Buscar producto..." />
                                    <CommandEmpty>No encontrado.</CommandEmpty>
                                    <CommandGroup>
                                        {initialProducts.map((product) => (
                                            <CommandItem
                                                key={product.id}
                                                value={`${product.name} ${product.sku || ""}`}
                                                onSelect={() => addItem(product as SerializedProduct)}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4 opacity-0"
                                                    )}
                                                />
                                                <div className="flex flex-col">
                                                    <span>{product.name}</span>
                                                    <span className="text-xs text-muted-foreground">SKU: {product.sku} | Stock: {product.stock}</span>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 space-y-4">
                        <h3 className="font-semibold">Detalles de Facturación y Envío</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Costo de Envío</label>
                                <Input
                                    type="number"
                                    value={shippingCost}
                                    onChange={(e) => setShippingCost(Number(e.target.value))}
                                    min={0}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Fecha de Entrega</label>
                                <DatePicker date={deliveryDate} setDate={setDeliveryDate} />
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox
                                id="ncf"
                                checked={hasNcf}
                                onCheckedChange={(c) => setHasNcf(!!c)}
                            />
                            <Label htmlFor="ncf">Requiere Comprobante Fiscal (NCF)</Label>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Notas / Observaciones</label>
                            <Textarea
                                placeholder="Instrucciones de entrega, notas internas..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <Card className="h-full flex flex-col">
                    <CardContent className="p-4 flex-1">
                        <h3 className="font-semibold mb-4">Detalle</h3>
                        <div className="space-y-2">
                            {items.map(item => (
                                <div key={item.productId} className="flex items-center justify-between border-b pb-2">
                                    <div className="flex-1">
                                        <p className="font-medium">{item.productName}</p>
                                        <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} x {item.quantity}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value))}
                                            className="w-16 h-8"
                                        />
                                        <div className="font-bold w-20 text-right">
                                            {formatCurrency(item.price * item.quantity)}
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.productId)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {items.length === 0 && <p className="text-center text-muted-foreground py-8">El carrito está vacío</p>}
                        </div>
                    </CardContent>
                    <div className="p-4 border-t bg-gray-50 rounded-b-lg space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-muted-foreground">
                                <span>Envío</span>
                                <span>{formatCurrency(shippingCost)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-red-600">
                                <span>ITBIS (18%)</span>
                                <span>{formatCurrency(taxAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                                <span>Total</span>
                                <span>{formatCurrency(total)}</span>
                            </div>
                        </div>

                        {/* Payment Details Section */}
                        {!isEdit && type !== "QUOTE" && (
                            <div className="border-t pt-4 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Método de Pago</label>
                                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CASH">Efectivo</SelectItem>
                                            <SelectItem value="TRANSFER">Transferencia</SelectItem>
                                            <SelectItem value="CARD">Tarjeta</SelectItem>
                                            <SelectItem value="CREDIT">Crédito</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {paymentMethod === "CASH" && (
                                    <div className="grid grid-cols-2 gap-4 bg-green-50 p-3 rounded-md border border-green-100">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-green-700">Recibido (Efectivo)</label>
                                            <Input
                                                type="number"
                                                className="bg-white"
                                                value={amountTendered || ""}
                                                onChange={(e) => setAmountTendered(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <label className="text-xs font-bold text-green-700 block">Devuelta</label>
                                            <div className="text-xl font-bold text-green-800 h-9 flex items-center justify-end">
                                                {formatCurrency(change)}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {!isEdit && (
                            <div className="flex gap-2 mt-4">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    size="lg"
                                    onClick={handlePreview}
                                    disabled={isPending || items.length === 0}
                                >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Previsualizar
                                </Button>
                                <Button
                                    className={cn("flex-1", type === "QUOTE" ? "bg-yellow-600 hover:bg-yellow-700" : "")}
                                    size="lg"
                                    onClick={handlePreview}
                                    disabled={isPending || items.length === 0}
                                >
                                    {isPending ? "Procesando..." : (type === "QUOTE" ? "Guardar Cotización" : "Facturar")}
                                </Button>
                            </div>
                        )}
                        {isEdit && (
                            <div className="flex gap-2 mt-4">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    size="lg"
                                    onClick={() => router.push("/invoices")}
                                    disabled={isPending}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className={cn("flex-1", type === "QUOTE" ? "bg-yellow-600 hover:bg-yellow-700" : "")}
                                    size="lg"
                                    onClick={handleConfirm}
                                    disabled={isPending}
                                >
                                    {isPending ? "Procesando..." : "Actualizar Factura"}
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="h-5 w-5" />
                            {type === "QUOTE" ? "Vista Previa de Cotización" : "Vista Previa de Factura"}
                        </DialogTitle>
                        <DialogDescription>
                            Revise los detalles antes de confirmar
                        </DialogDescription>
                    </DialogHeader>

                    {selectedClient && (
                        <div className="space-y-6">
                            {/* Client Info */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h3 className="font-semibold text-lg mb-3">Información del Cliente</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium">Nombre:</span> {selectedClient.name}
                                    </div>
                                    <div>
                                        <span className="font-medium">RNC/Cédula:</span> {selectedClient.rnc}
                                    </div>
                                    <div>
                                        <span className="font-medium">Teléfono:</span> {selectedClient.phone}
                                    </div>
                                    <div>
                                        <span className="font-medium">Email:</span> {selectedClient.email}
                                    </div>
                                    <div className="col-span-2">
                                        <span className="font-medium">Dirección:</span> {selectedClient.address}
                                    </div>
                                </div>
                            </div>

                            {/* Invoice Items */}
                            <div>
                                <h3 className="font-semibold text-lg mb-3">Detalle de Productos/Servicios</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Descripción</TableHead>
                                            <TableHead className="text-right">Cantidad</TableHead>
                                            <TableHead className="text-right">Precio Unitario</TableHead>
                                            <TableHead className="text-right">Subtotal</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => (
                                            <TableRow key={item.productId}>
                                                <TableCell>{item.productName}</TableCell>
                                                <TableCell className="text-right">{item.quantity}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(item.price * item.quantity)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Totals */}
                            <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Envío:</span>
                                    <span>{formatCurrency(shippingCost)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-red-600">
                                    <span>ITBIS (18%):</span>
                                    <span>{formatCurrency(taxAmount)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xl font-bold border-t border-blue-200 pt-2">
                                    <span>Total a Pagar:</span>
                                    <span className="text-blue-600">{formatCurrency(total)}</span>
                                </div>
                                {paymentMethod === "CASH" && amountTendered > 0 && (
                                    <div className="flex justify-between text-sm text-green-700 font-medium pt-2">
                                        <span>Recibido: {formatCurrency(amountTendered)}</span>
                                        <span>Devuelta: {formatCurrency(change)}</span>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 justify-end pt-4 border-t">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowPreview(false)}
                                    disabled={isPending}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className={cn(type === "QUOTE" ? "bg-yellow-600 hover:bg-yellow-700" : "")}
                                    onClick={handleConfirm}
                                    disabled={isPending}
                                >
                                    {isPending ? "Procesando..." : "Confirmar y " + (type === "QUOTE" ? "Crear Cotización" : "Facturar")}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
