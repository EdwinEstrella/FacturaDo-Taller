"use client"

import { useMemo, useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Check, ChevronsUpDown, Trash2, Eye, Plus, X } from "lucide-react"
import {
    getMeasurementLabel,
    getMeasurementModeFromProduct,
    getMeasurementShortLabel,
    isMeasuredMode,
    type ProductMeasurementMode,
} from "@/lib/product-measurements"
import { cn, formatCurrency, formatQuantity } from "@/lib/utils"
import { updateInvoice, createInvoice } from "@/actions/invoice-actions"
import { createQuote, updateQuote } from "@/actions/quote-actions"
import { createInstallationsForInvoice } from "@/actions/installation-actions"
import type { Client, Product, ProductCharacteristic, ProductVariant } from "@/types"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { DatePicker } from "@/components/ui/date-picker"
import { Textarea } from "@/components/ui/textarea"
import { InvoiceOdooTemplate } from "@/components/modules/invoices/invoice-odoo-template"
import { QuoteOdooTemplate } from "@/components/modules/quotes/quote-odoo-template"
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sourceQuote?: any // Optional quote data for converting to invoice
    documentType?: "INVOICE" | "QUOTE"
}

interface InvoiceItemState {
    id?: string
    lineId: string
    productId: string
    productName: string
    price: number
    quantity: number | string
    measurementMode: ProductMeasurementMode
    variantId?: string
    variantName?: string
    requiresInstallation?: boolean
    characteristics?: ProductCharacteristic[]
}

function getDefaultMeasurementMode(product?: SerializedProduct | Product) {
    return getMeasurementModeFromProduct(product)
}

function createLineId() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
}

function getInitialDiscount(initialData?: { discount?: number | string; total?: number | string; tax?: number | string; shippingCost?: number | string; items?: InvoiceItemState[] }) {
    if (!initialData) return 0
    if (initialData.discount !== undefined) return Number(initialData.discount || 0)

    const subtotal = (initialData.items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
    const tax = Number(initialData.tax || 0)
    const shipping = Number(initialData.shippingCost || 0)
    const total = Number(initialData.total || subtotal + tax + shipping)
    const derivedDiscount = subtotal + tax + shipping - total

    return derivedDiscount > 0 ? derivedDiscount : 0
}

function hydrateInitialItems(initialItems: InvoiceItemState[] | undefined, products: SerializedProduct[] | Product[]) {
    if (!initialItems) {
        return []
    }

    const productsById = new Map(products.map((product) => [product.id, product]))

    return initialItems.map((item) => ({
        ...item,
        lineId: item.lineId || item.id || createLineId(),
        quantity: Number(item.quantity || 0),
        measurementMode: getDefaultMeasurementMode(productsById.get(item.productId)),
        characteristics: item.characteristics || [],
    }))
}

export function InvoiceForm({ initialProducts, initialClients, initialData, sourceQuote, documentType }: InvoiceFormProps) {
    // Handling form state changes for HMR sync

    const dataToUse = initialData || sourceQuote
    const isEdit = !!initialData

    const [items, setItems] = useState<InvoiceItemState[]>(() => hydrateInitialItems(dataToUse?.items, initialProducts))
    const [selectedClientId, setSelectedClientId] = useState<string>(dataToUse?.clientId || "")
    const [isPending, startTransition] = useTransition()
    const [showPreview, setShowPreview] = useState(false)

    // New Fields State
    const [shippingCost, setShippingCost] = useState<number>(dataToUse?.shippingCost || 0)
    const [discount, setDiscount] = useState<number>(() => getInitialDiscount(dataToUse))
    const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(dataToUse?.deliveryDate ? new Date(dataToUse.deliveryDate) : undefined)
    const [notes, setNotes] = useState<string>(dataToUse?.notes || "")
    const [paymentMethod, setPaymentMethod] = useState<string>(dataToUse?.paymentMethod || "CASH")
    const [amountTendered, setAmountTendered] = useState<number>(0)
    const [applyTax, setApplyTax] = useState<boolean>(
        dataToUse?.applyTax !== undefined 
            ? dataToUse.applyTax 
            : dataToUse 
                ? (dataToUse.tax > 0) 
                : true
    )

    // Force sync when dataToUse changes (resolves Next.js caching / HMR issues when navigating from Quote to Invoice)
    useEffect(() => {
        if (dataToUse && dataToUse.id) {
            setItems(hydrateInitialItems(dataToUse.items, initialProducts))
            setSelectedClientId(dataToUse.clientId || "")
            setShippingCost(dataToUse.shippingCost || 0)
            setDiscount(getInitialDiscount(dataToUse))
            setDeliveryDate(dataToUse.deliveryDate ? new Date(dataToUse.deliveryDate) : undefined)
            setNotes(dataToUse.notes || "")
            setPaymentMethod(dataToUse.paymentMethod || "CASH")
            setApplyTax(
                dataToUse.applyTax !== undefined 
                    ? dataToUse.applyTax 
                    : (dataToUse.tax > 0)
            )
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataToUse?.id]) // Only depend on the ID to prevent infinite loops from object reference changes

    const searchParams = useSearchParams()
    const router = useRouter()
    
    const type = documentType || (searchParams.get("type") === "QUOTE" ? "QUOTE" : "INVOICE")
    const isQuoteMode = type === "QUOTE"

    // Product Search State
    const [openProduct, setOpenProduct] = useState(false)
    const [openClient, setOpenClient] = useState(false)

    // Installation Modal State
    const [installationModal, setInstallationModal] = useState<{
        open: boolean
        product: SerializedProduct | null
        variant?: { id: string; name: string; price: number }
    }>({ open: false, product: null })

    const addItem = (product: SerializedProduct, variant?: { id: string; name: string; price: number }, requiresInstallation?: boolean) => {
        if (requiresInstallation !== undefined) {
            setItems(prev => {
                const newItem: InvoiceItemState = {
                    lineId: createLineId(),
                    productId: product.id,
                    productName: variant ? `${product.name} - ${variant.name}` : product.name,
                    price: variant ? variant.price : Number(product.price),
                    quantity: 1,
                    measurementMode: getDefaultMeasurementMode(product),
                    requiresInstallation,
                    characteristics: [{ label: "Característica", value: "" }],
                }

                if (variant) {
                    newItem.variantId = variant.id
                    newItem.variantName = variant.name
                }

                return [...prev, newItem]
            })
            setOpenProduct(false)
        } else {
            // Mostrar modal preguntando si requiere instalación
            setInstallationModal({ open: true, product, variant })
        }
    }

    const handleInstallationYes = () => {
        if (installationModal.product) {
            addItem(installationModal.product, installationModal.variant, true)
        }
        setInstallationModal({ open: false, product: null })
    }

    const handleInstallationNo = () => {
        if (installationModal.product) {
            addItem(installationModal.product, installationModal.variant, false)
        }
        setInstallationModal({ open: false, product: null })
    }

    const handleInstallationCancel = () => {
        setInstallationModal({ open: false, product: null })
        setOpenProduct(false)
    }

    const removeItem = (lineId: string) => {
        setItems(prev => prev.filter(p => p.lineId !== lineId))
    }

    const updateQuantity = (lineId: string, q: string | number) => {
        if (q === "") {
            setItems(prev => prev.map(p => {
                return p.lineId === lineId ? { ...p, quantity: q } : p
            }))
            return
        }

        const numValue = Number(q)
        if (numValue < 0) return

        setItems(prev => prev.map(p => {
            const isTarget = p.lineId === lineId

            if (!isTarget) {
                return p
            }

            if (!isMeasuredMode(p.measurementMode) && !Number.isInteger(numValue)) {
                return p
            }

            return { ...p, quantity: q }
        }))
    }

    const addCharacteristic = (lineId: string) => {
        setItems((currentItems) => currentItems.map((item) => (
            item.lineId === lineId
                ? { ...item, characteristics: [...(item.characteristics || []), { label: "Característica", value: "" }] }
                : item
        )))
    }

    const updateCharacteristic = (lineId: string, index: number, field: keyof ProductCharacteristic, value: string) => {
        setItems((currentItems) => currentItems.map((item) => {
            if (item.lineId !== lineId) return item

            return {
                ...item,
                characteristics: (item.characteristics || []).map((characteristic, currentIndex) => (
                    currentIndex === index ? { ...characteristic, [field]: value } : characteristic
                )),
            }
        }))
    }

    const removeCharacteristic = (lineId: string, index: number) => {
        setItems((currentItems) => currentItems.map((item) => (
            item.lineId === lineId
                ? { ...item, characteristics: (item.characteristics || []).filter((_, currentIndex) => currentIndex !== index) }
                : item
        )))
    }

    // Mapa de productos para saber si son servicios / exentos de ITBIS
    const productMap = useMemo(() => {
        const map = new Map<string, SerializedProduct | Product>()
        for (const p of initialProducts as SerializedProduct[]) {
            // SerializedProduct es compatible con Product en los campos que usamos
            map.set(p.id as string, p)
        }
        return map
    }, [initialProducts])

    const subtotal = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.price * Number(item.quantity || 0)), 0)
    }, [items])

    // Solo aplicamos ITBIS a productos que NO son servicios
    const taxableSubtotal = items.reduce((acc, item) => {
        const product = productMap.get(item.productId)
        // Se considera servicio si isService es true o la categoría es "SERVICIO"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const asAny = product as any | undefined
        const isService = asAny?.isService || asAny?.category === "SERVICIO"
        if (isService) return acc
        return acc + (item.price * Number(item.quantity || 0))
    }, 0)

    const taxAmount = applyTax ? taxableSubtotal * 0.18 : 0
    const activeDiscount = Math.min(Math.max(discount, 0), subtotal + taxAmount + shippingCost)
    const total = Math.max(0, subtotal + taxAmount + shippingCost - activeDiscount)
    const change = (paymentMethod === "CASH" && amountTendered > total) ? amountTendered - total : 0

    const resetCreateForm = () => {
        setItems([])
        setSelectedClientId("")
        setShippingCost(0)
        setDiscount(0)
        setDeliveryDate(undefined)
        setNotes("")
        setPaymentMethod("CASH")
        setAmountTendered(0)
        setApplyTax(true)
    }

    const handlePreview = () => {
        if (!selectedClientId) return toast.error("Seleccione un cliente")
        if (items.length === 0) return toast.error("Agregue productos")
        setShowPreview(true)
    }

    const submitDocument = (saveAsDraft = false) => {
        const selectedClient = initialClients.find(c => c.id === selectedClientId)
        if (!selectedClient) return toast.error("Cliente inválido")

        startTransition(async () => {
            let res;

            const parsedItems = items.map((item) => {
                const characteristics: ProductCharacteristic[] = []
                for (const characteristic of item.characteristics || []) {
                    if (characteristic.value.trim()) {
                        characteristics.push({ label: characteristic.label || "Característica", value: characteristic.value })
                    }
                }

                return {
                    ...item,
                    quantity: Number(item.quantity || 0),
                    characteristics,
                }
            })

            if (isEdit) {
                // Edit Mode
                if (type === "QUOTE") {
                    res = await updateQuote(initialData.id, {
                        clientId: selectedClientId,
                        items: parsedItems,
                        total,
                        shippingCost,
                        notes,
                        tax: taxAmount,
                        discount: activeDiscount,
                        applyTax,
                        isDraft: saveAsDraft,
                    })
                } else {
                    res = await updateInvoice(initialData.id, {
                        clientId: selectedClientId,
                        clientName: selectedClient.name,
                        items: parsedItems,
                        total,
                        paymentMethod,
                        shippingCost,
                        discount: activeDiscount,
                        deliveryDate,
                        notes,
                        tax: taxAmount,
                        hasNcf: taxAmount > 0,
                    })
                }
            } else {
                // Create Mode
                if (type === "QUOTE") {
                    res = await createQuote({
                        clientId: selectedClientId,
                        items: parsedItems,
                        total,
                        shippingCost,
                        notes,
                        tax: taxAmount,
                        discount: activeDiscount,
                        applyTax,
                        isDraft: saveAsDraft,
                    })
                } else {
                    res = await createInvoice({
                        clientId: selectedClientId,
                        clientName: selectedClient.name,
                        items: parsedItems,
                        total,
                        paymentMethod,
                        shippingCost,
                        discount: activeDiscount,
                        deliveryDate,
                        notes,
                        amountPaid: paymentMethod === "CREDIT" ? 0 : (amountTendered > 0 ? amountTendered : undefined),
                        tax: taxAmount,
                        hasNcf: taxAmount > 0,
                        sourceQuoteId: sourceQuote ? sourceQuote.id : undefined,
                    })
                }
            }

            if (res.success) {
                // Crear instalaciones para items que las requieren (solo en facturas, no cotizaciones)
                if (!isEdit && !isQuoteMode) {
                    const invoiceId = 'invoiceId' in res ? res.invoiceId as string : undefined

                    if (invoiceId) {
                        const installationItems = items
                            .filter(item => item.requiresInstallation)
                            .map(item => ({
                                invoiceId,
                                productId: item.productId,
                                productName: item.productName,
                                quantity: Number(item.quantity || 0),
                                clientName: selectedClient.name,
                                clientAddress: selectedClient.address,
                                clientPhone: selectedClient.phone
                            }))

                        if (installationItems.length > 0) {
                            await createInstallationsForInvoice(installationItems)
                            toast.success(`${installationItems.length} producto(s) agregado(s) a Pendientes de Instalación`)
                        }
                    }
                }

                toast.success(
                    isEdit
                        ? "Factura Actualizada"
                        : isQuoteMode
                            ? (saveAsDraft ? "Borrador guardado" : "Cotización creada")
                            : "Factura Creada!"
                )
                if (!isEdit) {
                    resetCreateForm()
                }
                router.push(isQuoteMode ? "/quotes" : "/invoices")
                router.refresh()
            } else {
                toast.error("Error: " + res.error)
            }
        })
    }

    const handleConfirm = () => {
        setShowPreview(false)
        submitDocument(false)
    }

    const handleSaveDraft = () => {
        if (!selectedClientId) return toast.error("Seleccione un cliente")
        if (items.length === 0) return toast.error("Agregue productos")
        setShowPreview(false)
        submitDocument(true)
    }

    const selectedClient = initialClients.find(c => c.id === selectedClientId)
    const previewDocument = selectedClient ? {
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        client: selectedClient,
        items: items.map((item) => ({
            ...item,
            quantity: Number(item.quantity || 0),
            characteristics: (item.characteristics || []).filter((characteristic) => characteristic.value.trim()),
        })),
        total,
        balance: Math.max(total - amountTendered, 0),
        status: amountTendered >= total ? "PAID" : "PENDING",
        shippingCost,
        tax: taxAmount,
        discount: activeDiscount,
        deliveryDate: deliveryDate?.toISOString(),
        notes,
        createdAt: new Date().toISOString(),
        sequenceNumber: initialData?.sequenceNumber || "VISTA PREVIA",
        applyTax,
    } : null

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-6">
                <Card>
                    <CardContent className="p-4 space-y-4">
                        <h3 className="font-semibold text-lg">
                            {isEdit ? (isQuoteMode ? "Editar Cotización" : "Editar Factura") : (type === "QUOTE" ? "Nueva Cotización" : "Nueva Factura")}
                        </h3>
                        
                        <div className={cn("p-2 rounded text-sm mb-2", isQuoteMode ? "bg-yellow-100" : "bg-blue-100")}>
                            {isQuoteMode 
                                ? "Modo: Cotización (no descuenta stock, no consume NCF y no afecta contabilidad)"
                                : isEdit ? "Modo Edición: El stock se recalculará automáticamente." : "Modo: Facturación (descuenta stock)"}
                        </div>

                        <Popover open={openClient} onOpenChange={setOpenClient}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-controls="client-popover"
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
                                    <CommandList>
                                        <CommandEmpty>Cliente no encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {initialClients.map((client) => (
                                                <CommandItem
                                                    key={client.id}
                                                    value={client.id}
                                                    keywords={[client.name, client.rnc || ""]}
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
                                    </CommandList>
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
                                <Button variant="outline" role="combobox" aria-controls="product-popover" aria-expanded={openProduct} className="w-full justify-between">
                                    Buscar producto...
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                                <Command>
                                    <CommandInput placeholder="Buscar producto..." />
                                    <CommandList>
                                        <CommandEmpty>No encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {(initialProducts as SerializedProduct[]).map((product) => {
                                                // Si tiene variantes, mostrar las variantes en lugar del producto
                                                if (product.hasVariants && product.variants && product.variants.length > 0) {
                                                    return (
                                                        <div key={product.id}>
                                                            {product.variants.map((variant: ProductVariant) => (
                                                                <CommandItem
                                                                    key={variant.id}
                                                                    value={`${product.name} ${variant.name} ${variant.sku || ""}`}
                                                                    onSelect={() => addItem(product, { id: variant.id, name: variant.name, price: Number(variant.price) })}
                                                                >
                                                                    <Check className="mr-2 h-4 w-4 opacity-0" />
                                                                    <div className="flex flex-col">
                                                                        <span>{product.name} - {variant.name}</span>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            SKU: {variant.sku || product.sku} | Precio: RD${Number(variant.price)}
                                                                        </span>
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </div>
                                                    )
                                                }

                                                // Producto sin variantes
                                                return (
                                                    <CommandItem
                                                        key={product.id}
                                                        value={`${product.name} ${product.sku || ""}`}
                                                        onSelect={() => addItem(product)}
                                                    >
                                                        <Check className="mr-2 h-4 w-4 opacity-0" />
                                                         <div className="flex flex-col">
                                                             <span>{product.name}</span>
                                                             <span className="text-xs text-muted-foreground">
                                                                SKU: {product.sku} | Stock: {formatQuantity(product.stock)} {getMeasurementShortLabel(getDefaultMeasurementMode(product))} | {getMeasurementLabel(getDefaultMeasurementMode(product))}
                                                             </span>
                                                         </div>
                                                     </CommandItem>
                                                )
                                            })}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 space-y-4">
                        <h3 className="font-semibold">{isQuoteMode ? "Detalles de Cotización y Envío" : "Detalles de Facturación y Envío"}</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="shipping-cost" className="text-sm font-medium">Costo de Envío</Label>
                                <Input
                                    id="shipping-cost"
                                    type="number"
                                    value={shippingCost}
                                    onChange={(e) => setShippingCost(Number(e.target.value))}
                                    min={0}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="document-discount" className="text-sm font-medium">Discount</Label>
                                <Input
                                    id="document-discount"
                                    type="number"
                                    value={discount}
                                    onChange={(e) => setDiscount(Number(e.target.value || 0))}
                                    min={0}
                                />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Fecha de Entrega</p>
                                <DatePicker date={deliveryDate} setDate={setDeliveryDate} />
                            </div>
                        </div>

                        {isQuoteMode ? (
                            <div className="space-y-3 rounded-md border border-yellow-200 bg-yellow-50 p-3">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="apply-tax"
                                        checked={applyTax}
                                        onCheckedChange={(c) => setApplyTax(!!c)}
                                    />
                                    <Label htmlFor="apply-tax">Mostrar ITBIS (18%) en esta cotización</Label>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Las cotizaciones no consumen NCF ni generan movimientos contables. El ITBIS solo se reflejará si está activado aquí.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="apply-tax-invoice"
                                        checked={applyTax}
                                        onCheckedChange={(c) => setApplyTax(!!c)}
                                    />
                                    <Label htmlFor="apply-tax-invoice">Aplicar ITBIS (18%) en esta factura</Label>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Al cobrar ITBIS se asignará automáticamente el próximo comprobante fiscal B01.
                                </p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="document-notes" className="text-sm font-medium">Notas / Observaciones</Label>
                            <Textarea
                                id="document-notes"
                                placeholder="Instrucciones de entrega, notas internas..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") e.stopPropagation()
                                }}
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
                                <div key={item.lineId} className="border-b pb-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                            <p className="font-medium">{item.productName}</p>
                                            <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} x {formatQuantity(Number(item.quantity || 0))} {getMeasurementShortLabel(item.measurementMode)}</p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Input
                                                type="number"
                                                step={isMeasuredMode(item.measurementMode) ? "0.01" : "1"}
                                                min={isMeasuredMode(item.measurementMode) ? "0.01" : "1"}
                                                value={item.quantity}
                                                onChange={(e) => updateQuantity(item.lineId, e.target.value)}
                                                className="w-24 h-8"
                                            />
                                            <div className="font-bold min-w-28 text-right px-2">
                                                {formatCurrency(item.price * Number(item.quantity || 0))}
                                            </div>
                                            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeItem(item.lineId)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="mt-3 w-full space-y-2 rounded-md bg-muted/40 p-2">
                                        {(item.characteristics || []).map((characteristic, index) => (
                                            <div key={`${item.lineId}-${index}`} className="flex gap-2">
                                                <Input value={characteristic.value} onChange={(event) => updateCharacteristic(item.lineId, index, "value", event.target.value)} placeholder="Características" className="h-8 flex-1 text-xs" />
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeCharacteristic(item.lineId, index)} aria-label={`Eliminar característica ${index + 1}`}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button type="button" variant="ghost" size="sm" className="h-7 px-1 text-xs" onClick={() => addCharacteristic(item.lineId)}>
                                            <Plus className="mr-1 h-3 w-3" />
                                            Más
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
                            {activeDiscount > 0 && (
                                <div className="flex justify-between items-center text-sm text-emerald-700">
                                    <span>Discount</span>
                                    <span>-{formatCurrency(activeDiscount)}</span>
                                </div>
                            )}
                            <div className={cn(
                                "flex justify-between items-center text-sm",
                                applyTax ? "text-red-600" : "text-muted-foreground"
                            )}>
                                <span>{applyTax ? "ITBIS (18%)" : "ITBIS desactivado"}</span>
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
                                    <Label htmlFor="payment-method" className="text-sm font-medium">Método de Pago</Label>
                                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                        <SelectTrigger id="payment-method">
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

                                {paymentMethod !== "CREDIT" && (
                                    <div className={cn(
                                        "grid gap-4 p-3 rounded-md border",
                                        paymentMethod === "CASH" ? "grid-cols-2 bg-green-50 border-green-100" : "grid-cols-1 bg-blue-50 border-blue-100"
                                    )}>
                                        <div className="space-y-1">
                                            <Label htmlFor="amount-tendered" className={cn(
                                                "text-xs font-bold block",
                                                paymentMethod === "CASH" ? "text-green-700" : "text-blue-700"
                                            )}>
                                                Monto Recibido / Abono ({paymentMethod === "CASH" ? "Efectivo" : paymentMethod === "TRANSFER" ? "Transferencia" : "Tarjeta"})
                                            </Label>
                                            <Input
                                                id="amount-tendered"
                                                type="number"
                                                className="bg-white"
                                                placeholder={total.toString()}
                                                value={amountTendered || ""}
                                                onChange={(e) => setAmountTendered(Number(e.target.value))}
                                            />
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                Dejar en blanco para registrar pago completo
                                            </p>
                                        </div>
                                        {paymentMethod === "CASH" && (
                                            <div className="space-y-1 text-right">
                                                <p className="text-xs font-bold text-green-700 block">Devuelta</p>
                                                <div className="text-xl font-bold text-green-800 h-9 flex items-center justify-end">
                                                    {formatCurrency(change)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {!isEdit && (
                            <div className="space-y-2 mt-4">
                                <div className="flex gap-2">
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
                                {isQuoteMode && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="w-full"
                                        size="lg"
                                        onClick={handleSaveDraft}
                                        disabled={isPending || items.length === 0}
                                    >
                                        {isPending ? "Procesando..." : "Guardar borrador"}
                                    </Button>
                                )}
                            </div>
                        )}
                        {isEdit && (
                            <div className="flex gap-2 mt-4">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    size="lg"
                                    onClick={() => router.push(isQuoteMode ? "/quotes" : "/invoices")}
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
                                    {isPending ? "Procesando..." : (isQuoteMode ? "Actualizar Cotización" : "Actualizar Factura")}
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] max-h-[90vh] w-[95vw] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-4rem)]">
                    <DialogHeader className="shrink-0 border-b px-6 py-5">
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="h-5 w-5" />
                            {type === "QUOTE" ? "Vista Previa de Cotización" : "Vista Previa de Factura"}
                        </DialogTitle>
                        <DialogDescription>
                            Revise los detalles antes de confirmar
                        </DialogDescription>
                    </DialogHeader>

                    {selectedClient && (
                        <>
                            <div className="min-h-0 min-w-0 overflow-y-auto px-6 py-5">
                                {previewDocument && (
                                    <div className="flex justify-center pb-4">
                                        {isQuoteMode
                                            ? <QuoteOdooTemplate quote={previewDocument} />
                                            : <InvoiceOdooTemplate invoice={previewDocument} />}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="shrink-0 border-t bg-background px-6 py-4">
                                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
                                        {isPending ? "Procesando..." : "Confirmar y " + (type === "QUOTE" ? "Guardar Cotización" : "Facturar")}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Installation Modal */}
            <Dialog open={installationModal.open} onOpenChange={(open) => {
                if (!open) handleInstallationCancel()
                setInstallationModal(prev => ({ ...prev, open }))
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Requiere Instalación?</DialogTitle>
                        <DialogDescription>
                            {installationModal.product && (
                                <span>Producto: <strong>{installationModal.variant
                                    ? `${installationModal.product.name} - ${installationModal.variant.name}`
                                    : installationModal.product.name}</strong></span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-muted-foreground">
                            ¿Este producto requiere instalación para el cliente?
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            Si selecciona &quot;Sí&quot;, se creará una orden de producción en el módulo de Pendientes.
                        </p>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={handleInstallationCancel}>
                            Cancelar
                        </Button>
                        <Button variant="secondary" onClick={handleInstallationNo}>
                            No
                        </Button>
                        <Button onClick={handleInstallationYes}>
                            Sí, requiere instalación
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
