"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Check, ChevronsUpDown, Trash2 } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { updateInvoice, createInvoice } from "@/actions/invoice-actions"
import { createQuote } from "@/actions/quote-actions"
import { Client, Product } from "@prisma/client"
import { useSearchParams, useRouter } from "next/navigation"

interface InvoiceFormProps {
    initialProducts: Product[]
    initialClients: Client[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialData?: any // Optional initial data for editing
}

export function InvoiceForm({ initialProducts, initialClients, initialData }: InvoiceFormProps) {
    // Initialize items from initialData if exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [items, setItems] = useState<any[]>(initialData?.items || [])
    const [selectedClientId, setSelectedClientId] = useState<string>(initialData?.clientId || "")
    const [isPending, startTransition] = useTransition()

    const searchParams = useSearchParams()
    const router = useRouter()
    // Determine type: explicitly QUOTE param, OR if we are editing an Invoice (no param usually)
    // If initialData exists, we assume we are editing whatever type passing in, but usually Invoice editing.
    const isEdit = !!initialData
    const type = searchParams.get("type") === "QUOTE" ? "QUOTE" : "INVOICE"

    // Product Search State
    const [openProduct, setOpenProduct] = useState(false)

    const addItem = (product: Product) => {
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

    const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0)

    const handleSave = () => {
        if (!selectedClientId) return alert("Seleccione un cliente")
        if (items.length === 0) return alert("Agregue productos")

        const selectedClient = initialClients.find(c => c.id === selectedClientId)
        if (!selectedClient) return alert("Cliente inválido")

        startTransition(async () => {
            let res;

            if (isEdit) {
                // Edit Mode (Always Invoice for now)
                res = await updateInvoice(initialData.id, {
                    clientId: selectedClientId,
                    clientName: selectedClient.name,
                    items,
                    total,
                    paymentMethod: initialData.paymentMethod
                })
            } else {
                // Create Mode
                if (type === "QUOTE") {
                    res = await createQuote({
                        clientId: selectedClientId,
                        items,
                    })
                } else {
                    res = await createInvoice({
                        clientId: selectedClientId,
                        clientName: selectedClient.name,
                        items,
                        total,
                        paymentMethod: "CASH"
                    })
                }
            }

            if (res.success) {
                alert(isEdit ? "Factura Actualizada" : (type === "QUOTE" ? "Cotización Creada!" : "Factura Creada!"))
                if (!isEdit) {
                    setItems([])
                    setSelectedClientId("")
                }
                router.push("/invoices")
                router.refresh()
            } else {
                alert("Error: " + res.error)
            }
        })
    }

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

                        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar Cliente" />
                            </SelectTrigger>
                            <SelectContent>
                                {initialClients.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                                                value={product.name}
                                                onSelect={() => addItem(product)}
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
                    <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                        <div className="flex justify-between items-center text-lg font-bold">
                            <span>Total</span>
                            <span>{formatCurrency(total)}</span>
                        </div>
                        <Button
                            className={cn("w-full mt-4", type === "QUOTE" ? "bg-yellow-600 hover:bg-yellow-700" : "")}
                            size="lg"
                            onClick={handleSave}
                            disabled={isPending}
                        >
                            {isPending ? "Procesando..." : (isEdit ? "Actualizar Factura" : (type === "QUOTE" ? "Guardar Cotización" : "Facturar / Imprimir"))}
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    )
}
