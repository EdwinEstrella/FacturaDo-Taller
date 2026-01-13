"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { CalendarIcon, Loader2, Plus, Trash2, Check, ChevronsUpDown } from "lucide-react"

import { cn, formatCurrency } from "@/lib/utils"
import { createPurchase, createSupplier } from "@/actions/purchase-actions"
import { useRouter } from "next/navigation"
import { quickCreateProduct } from "@/actions/product-actions"
import { toast } from "sonner"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface Supplier {
    id: string
    name: string
}

interface Product {
    id: string
    name: string
    stock: number
    cost: number | null
    price: number
    sku: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    variants?: any[]
}

interface PurchaseItem {
    productId: string
    productName: string
    quantity: number
    quantityType: "UNIT" | "BOX" | "MEASURE"
    unitCost: number
    total: number
    newCost?: number
    newPrice?: number
}

interface PurchaseFormProps {
    suppliers: Supplier[]
    products: Product[]
}

export default function PurchaseForm({ suppliers: initialSuppliers, products: initialProducts }: PurchaseFormProps) {
    // Form State
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [supplierId, setSupplierId] = useState<string>("")
    const [items, setItems] = useState<PurchaseItem[]>([])
    const [notes, setNotes] = useState("")
    const router = useRouter()

    // Supplier Creation State
    const [suppliers, setSuppliers] = useState(initialSuppliers)
    const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false)
    const [newSupplierName, setNewSupplierName] = useState("")
    const [newSupplierPending, startSupplierTransition] = useTransition()

    // NEW: Product Creation State
    const [products, setProducts] = useState(initialProducts)
    const [isNewProductOpen, setIsNewProductOpen] = useState(false)
    const [newProductName, setNewProductName] = useState("")
    const [newProductPrice, setNewProductPrice] = useState(0) // Selling Price
    const [newProductCategory, setNewProductCategory] = useState<"ARTICULO" | "MATERIAL" | "SERVICIO">("ARTICULO")
    const [newProductPending, startProductTransition] = useTransition()

    // Item Addition State
    const [selectedProductId, setSelectedProductId] = useState("")
    const [quantity, setQuantity] = useState(1)
    const [quantityType, setQuantityType] = useState<"UNIT" | "BOX" | "MEASURE">("UNIT")
    const [unitCost, setUnitCost] = useState(0)
    const [openCombobox, setOpenCombobox] = useState(false)

    // Costing & Pricing State
    const [pricingMode, setPricingMode] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE")
    const [margin, setMargin] = useState(30) // Default 30%
    const [fixedPrice, setFixedPrice] = useState(0)
    const [newSellingPrice, setNewSellingPrice] = useState(0)
    const [avgCost, setAvgCost] = useState(0)

    const [isPending, startTransition] = useTransition()

    // Calculations
    const selectedProduct = products.find(p => p.id === selectedProductId)

    // Effect: Calculate Weighted Average Cost when inputs change
    // Using a simple effect or just memoized values. Effect is better if we want to allow manual override without fighting calculations.
    // However, for simplicity in React, let's use an effect that updates ONLY when base inputs change, guarding against loops.
    // Or just simple function called during render or handler? 
    // Let's use effects to update "Suggested" values when quantity/cost changes, but allow user override.

    // Better approach: Calculate on changes, but only if user hasn't manually overridden? 
    // Simplest: Calculate on change of [quantity, unitCost, selectedProductId].

    // Effect for Avg Cost & Selling Price
    useEffect(() => {
        if (!selectedProduct) return

        const currentStock = selectedProduct.stock || 0
        const currentCost = Number(selectedProduct.cost) || 0
        const newQty = quantity
        const newUnitCost = unitCost

        // 1. Calculate Avg Cost (weighted average)
        let currentAvgCost = 0
        const totalQty = currentStock + newQty

        if (totalQty === 0) {
            currentAvgCost = newUnitCost
        } else {
            currentAvgCost = ((currentStock * currentCost) + (newQty * newUnitCost)) / totalQty
        }

        const finalAvgCost = parseFloat(currentAvgCost.toFixed(2))
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAvgCost(finalAvgCost)

        // 2. Calculate Selling Price based on pricing mode
        if (pricingMode === "PERCENTAGE") {
            // Calculate using margin percentage
            const price = finalAvgCost * (1 + (margin / 100))
            setNewSellingPrice(parseFloat(price.toFixed(2)))
        } else {
            // Use fixed price directly
            setNewSellingPrice(parseFloat(fixedPrice.toFixed(2)))
        }

    }, [quantity, unitCost, selectedProduct, margin, pricingMode, fixedPrice])


    // Handlers

    const handleAddSupplier = () => {
        if (!newSupplierName.trim()) return

        startSupplierTransition(async () => {
            const res = await createSupplier({ name: newSupplierName })
            if (res.success && res.supplier) {
                toast.success("Proveedor creado")
                setSuppliers([...suppliers, res.supplier])
                setSupplierId(res.supplier.id) // Auto select
                setIsNewSupplierOpen(false)
                setNewSupplierName("")
            } else {
                toast.error(res.error || "Error al crear proveedor")
            }
        })
    }

    const handleAddProduct = () => {
        if (!newProductName.trim()) return toast.error("Nombre requerido")

        startProductTransition(async () => {
            const res = await quickCreateProduct({
                name: newProductName,
                price: newProductPrice,
                category: newProductCategory
            })

            if (res.success && res.product) {
                toast.success("Producto creado")
                setProducts([...products, res.product])
                setSelectedProductId(res.product.id) // Auto select
                setUnitCost(0) // New product has 0 cost initially, user sets it in purchase
                setIsNewProductOpen(false)
                setNewProductName("")
                setNewProductPrice(0)
            } else {
                toast.error(res.error || "Error al crear producto")
            }
        })
    }

    const handleProductSelect = (productId: string) => {
        const product = products.find(p => p.id === productId)
        if (product) {
            setSelectedProductId(productId)
            setUnitCost(Number(product.cost) || 0) // Default to current cost
            // Price/Margin will auto-calc via effects
            setOpenCombobox(false)
        }
    }

    const handleAddItem = () => {
        if (!selectedProductId) return toast.error("Seleccione un producto")
        if (quantity <= 0) return toast.error("La cantidad debe ser mayor a 0")
        if (unitCost < 0) return toast.error("El costo no puede ser negativo")

        const product = products.find(p => p.id === selectedProductId)
        if (!product) return

        const newItem: PurchaseItem & { newCost?: number, newPrice?: number } = {
            productId: selectedProductId,
            productName: product.name,
            quantity,
            quantityType,
            unitCost,
            total: quantity * unitCost,
            newCost: avgCost,
            newPrice: newSellingPrice
        }

        setItems([...items, newItem])
        // Reset item inputs
        setSelectedProductId("")
        setQuantity(1)
        setQuantityType("UNIT")
        setUnitCost(0)
        setPricingMode("PERCENTAGE")
        setMargin(30)
        setFixedPrice(0)
    }

    const handleRemoveItem = (index: number) => {
        const newItems = [...items]
        newItems.splice(index, 1)
        setItems(newItems)
    }

    const handleSubmit = () => {
        if (!supplierId) return toast.error("Seleccione un proveedor")
        if (!date) return toast.error("Seleccione una fecha")
        if (items.length === 0) return toast.error("Agregue al menos un producto")

        startTransition(async () => {
            const res = await createPurchase({
                supplierId,
                supplierName: suppliers.find(s => s.id === supplierId)?.name,
                date,
                items,
                notes
            })

            if (res.success) {
                toast.success("Compra registrada correctamente")
                // Reset Form
                setItems([])
                setNotes("")
                setSupplierId("")
                setDate(new Date())
                router.refresh()
            } else {
                toast.error(res.error || "Error al registrar compra")
            }
        })
    }

    const totalAmount = items.reduce((sum, item) => sum + item.total, 0)
    // selectedProduct is already declared above

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Form Header */}
                <Card>
                    <CardHeader>
                        <CardTitle>Detalles de la Compra</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Supplier Selection */}
                        <div className="flex flex-col space-y-2">
                            <Label>Proveedor</Label>
                            <div className="flex gap-2">
                                <Select value={supplierId} onValueChange={setSupplierId}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Seleccionar proveedor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Dialog open={isNewSupplierOpen} onOpenChange={setIsNewSupplierOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="icon"><Plus className="h-4 w-4" /></Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Nuevo Proveedor</DialogTitle>
                                            <DialogDescription>Agregue un nuevo proveedor para sus compras.</DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4">
                                            <Label>Nombre</Label>
                                            <Input
                                                value={newSupplierName}
                                                onChange={(e) => setNewSupplierName(e.target.value)}
                                                placeholder="Ej. Comercial XYZ"
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={handleAddSupplier} disabled={newSupplierPending}>
                                                {newSupplierPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Guardar
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>

                        {/* Date Selection */}
                        <div className="flex flex-col space-y-2">
                            <Label>Fecha de Compra</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "dd/MM/yyyy") : <span>Seleccionar fecha</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Notes */}
                        <div className="flex flex-col space-y-2">
                            <Label>Notas (Opcional)</Label>
                            <Input
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Referencia de factura, etc."
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Right Column: Add Items */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-base font-semibold">Agregar Productos</CardTitle>
                        <Dialog open={isNewProductOpen} onOpenChange={setIsNewProductOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 border-dashed">
                                    <Plus className="mr-2 h-4 w-4" /> Nuevo
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Nuevo Producto</DialogTitle>
                                    <DialogDescription>Cree un producto rápidamente para agregarlo a la compra.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Nombre</Label>
                                        <Input value={newProductName} onChange={e => setNewProductName(e.target.value)} placeholder="Ej. Martillo" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Precio Venta (Público)</Label>
                                        <Input type="number" min="0" value={newProductPrice} onChange={e => setNewProductPrice(Number(e.target.value))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Categoría</Label>
                                        <Select value={newProductCategory} onValueChange={(v: "ARTICULO" | "MATERIAL" | "SERVICIO") => setNewProductCategory(v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione categoría" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ARTICULO">Artículo</SelectItem>
                                                <SelectItem value="MATERIAL">Material</SelectItem>
                                                <SelectItem value="SERVICIO">Servicio</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleAddProduct} disabled={newProductPending}>
                                        {newProductPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Crear
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col space-y-2">
                            <Label>Producto</Label>
                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCombobox}
                                        className="w-full justify-between"
                                    >
                                        {selectedProductId
                                            ? products.find((p) => p.id === selectedProductId)?.name
                                            : "Buscar producto..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                    <Command>
                                        <CommandInput placeholder="Buscar producto..." />
                                        <CommandList>
                                            <CommandEmpty>No se encontraron productos.</CommandEmpty>
                                            <CommandGroup>
                                                {products.map((product) => (
                                                    <CommandItem
                                                        key={product.id}
                                                        value={product.name}
                                                        onSelect={() => handleProductSelect(product.id)}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedProductId === product.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {product.name}
                                                        {product.sku && <span className="ml-2 text-xs text-muted-foreground">({product.sku})</span>}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Cantidad</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        min="1"
                                        value={quantity}
                                        onChange={(e) => setQuantity(Number(e.target.value))}
                                        className="flex-1"
                                    />
                                    <Select value={quantityType} onValueChange={(v: "UNIT" | "BOX" | "MEASURE") => setQuantityType(v)}>
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue placeholder="Tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="UNIT">Unidad</SelectItem>
                                            <SelectItem value="BOX">Caja</SelectItem>
                                            <SelectItem value="MEASURE">Medida</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {selectedProduct && (
                                    <p className="text-xs text-muted-foreground">
                                        Stock actual: {selectedProduct.stock} | Costo Base: {formatCurrency(Number(selectedProduct.cost))}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Costo Unitario (Compra)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={unitCost}
                                    onChange={(e) => setUnitCost(Number(e.target.value))}
                                />
                            </div>
                        </div>

                        {selectedProduct && (
                            <div className="space-y-4">
                                {/* Pricing Mode Selector */}
                                <div className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <Label className="text-sm font-medium">Modo de Precio:</Label>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant={pricingMode === "PERCENTAGE" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setPricingMode("PERCENTAGE")}
                                        >
                                            Por Porcentaje %
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={pricingMode === "FIXED" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setPricingMode("FIXED")}
                                        >
                                            Precio Fijo
                                        </Button>
                                    </div>
                                </div>

                                {/* Calculation Fields */}
                                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg border">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Nuevo Costo Promedio</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={avgCost}
                                            onChange={(e) => setAvgCost(Number(e.target.value))}
                                            className="h-8 text-sm"
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            (Stock actual × Costo actual + Nueva cantidad × Nuevo costo) ÷ Total
                                        </p>
                                    </div>

                                    {pricingMode === "PERCENTAGE" ? (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-blue-600">% Ganancia</Label>
                                            <Input
                                                type="number"
                                                value={margin}
                                                onChange={(e) => setMargin(Number(e.target.value))}
                                                className="h-8 text-sm"
                                            />
                                            <p className="text-[10px] text-muted-foreground">
                                                Precio = Costo promedio × (1 + {margin}%)
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-purple-600">Precio Fijo</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={fixedPrice}
                                                onChange={(e) => setFixedPrice(Number(e.target.value))}
                                                className="h-8 text-sm"
                                            />
                                            <p className="text-[10px] text-muted-foreground">
                                                Precio manual sin cálculo
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-green-700">Precio Venta Sugerido</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={newSellingPrice}
                                            onChange={(e) => setNewSellingPrice(Number(e.target.value))}
                                            className="h-8 text-sm font-bold text-green-700"
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            {pricingMode === "PERCENTAGE"
                                                ? `Margen: ${((newSellingPrice - avgCost) / avgCost * 100).toFixed(1)}%`
                                                : `Margen: ${avgCost > 0 ? ((newSellingPrice - avgCost) / avgCost * 100).toFixed(1) : 0}%`
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Button onClick={handleAddItem} className="w-full">
                            <Plus className="mr-2 h-4 w-4" /> Agregar a la lista
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Productos en la Compra</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-right">Cantidad</TableHead>
                                <TableHead className="text-right">Tipo</TableHead>
                                <TableHead className="text-right">Costo Unit.</TableHead>
                                <TableHead className="text-right">Nuevo Precio</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                                        No hay productos agregados
                                    </TableCell>
                                </TableRow>
                            )}
                            {items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{item.productName}</TableCell>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell className="text-right">
                                        {item.quantityType === "UNIT" && "Unidad"}
                                        {item.quantityType === "BOX" && "Caja"}
                                        {item.quantityType === "MEASURE" && "Medida"}
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.unitCost)}</TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">{item.newPrice ? formatCurrency(item.newPrice) : '-'}</TableCell>
                                    <TableCell className="text-right font-bold">{formatCurrency(item.total)}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <div className="flex justify-end mt-6 items-center gap-4">
                        <div className="text-2xl font-bold">
                            Total: {formatCurrency(totalAmount)}
                        </div>
                        <Button size="lg" onClick={handleSubmit} disabled={isPending || items.length === 0}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Registrar Compra
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
