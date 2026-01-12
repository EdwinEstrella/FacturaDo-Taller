"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createProduct, updateProduct } from "@/actions/product-actions"
import { useFormStatus } from "react-dom"
import { useState } from "react"
import { Product } from "@prisma/client"
import { Edit, X } from "lucide-react"

function SubmitButton({ isEdit }: { isEdit: boolean }) {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : (isEdit ? "Actualizar" : "Guardar Producto")}
        </Button>
    )
}

export function ProductDialog({ product }: { product?: Omit<Product, 'price' | 'cost'> & { price: number, cost: number } }) {
    const [open, setOpen] = useState(false)
    const isEdit = !!product
    const [category, setCategory] = useState(product?.category || "ARTICULO")

    // Price/Cost/Margin State
    const initialCost = product?.cost || 0
    const initialPrice = product?.price || 0
    const [cost, setCost] = useState(initialCost)
    const [price, setPrice] = useState(initialPrice)
    const [margin, setMargin] = useState(() => {
        if (initialCost > 0 && initialPrice > 0) {
            return parseFloat((((initialPrice - initialCost) / initialCost) * 100).toFixed(2))
        }
        return 30 // Default 30% margin
    })

    const handleCostChange = (val: number) => {
        setCost(val)
        // Auto-update price based on margin
        const newPrice = val * (1 + margin / 100)
        setPrice(parseFloat(newPrice.toFixed(2)))
    }

    const handleMarginChange = (val: number) => {
        setMargin(val)
        // Auto-update price based on cost
        const newPrice = cost * (1 + val / 100)
        setPrice(parseFloat(newPrice.toFixed(2)))
    }

    const handlePriceChange = (val: number) => {
        setPrice(val)
        // Auto-update margin based on cost? Or just leave it?
        // Usually if I edit price, I want to see the new margin.
        if (cost > 0) {
            const newMargin = ((val - cost) / cost) * 100
            setMargin(parseFloat(newMargin.toFixed(2)))
        }
    }

    interface Variant {
        id?: string
        name: string
        price: number
        stock: number
        sku: string
        cost: number
        margin?: number
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [variants, setVariants] = useState<Variant[]>((product as any)?.variants?.map((v: any) => ({ ...v, cost: Number(v.cost || 0) })) || [])

    const addVariant = () => {
        setVariants([...variants, { name: "", price: price, cost: cost, stock: 0, sku: "", margin: margin }])
    }

    const removeVariant = (index: number) => {
        setVariants(variants.filter((_, i) => i !== index))
    }

    const updateVariant = (index: number, field: keyof Variant, value: string | number) => {
        const newVariants = [...variants]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = { ...newVariants[index], [field]: value } as any

        // internal calculation for variant logic similar to main product?
        // If cost changes, update price?
        if (field === "cost") {
            const c = Number(value)
            const m = v.margin || 30
            v.price = parseFloat((c * (1 + m / 100)).toFixed(2))
        } else if (field === "price") {
            // update margin logic if needed, but maybe keep simple for variants
            if (v.cost > 0) {
                v.margin = parseFloat((((Number(value) - v.cost) / v.cost) * 100).toFixed(2))
            }
        }

        newVariants[index] = v
        setVariants(newVariants)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {isEdit ? (
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                ) : (
                    <Button>Agregar Producto</Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Editar Producto" : "Agregar Producto"}</DialogTitle>
                    <DialogDescription>
                        Ingrese el costo y margen para calcular el precio automáticamente.
                    </DialogDescription>
                </DialogHeader>
                <form action={async (formData) => {
                    formData.set("variants", JSON.stringify(variants))
                    // Ensure price/cost are set from state if controlled
                    // But input fields with name attribute will override?
                    // Best to use hidden inputs or ensure inputs have correct values
                    if (isEdit && product) {
                        await updateProduct(product.id, null, formData)
                    } else {
                        await createProduct(null, formData)
                    }
                    setOpen(false)
                }}>
                    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="category" className="text-right">Categoría</Label>
                            <div className="col-span-3">
                                <Select name="category" defaultValue={category} onValueChange={setCategory}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MATERIAL">Material</SelectItem>
                                        <SelectItem value="ARTICULO">Artículo</SelectItem>
                                        <SelectItem value="SERVICIO">Servicio</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="unitType" className="text-right">Unidad de Medida</Label>
                            <div className="col-span-3">
                                <Select name="unitType" defaultValue={(product as any)?.unitType || "UNIT"}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="UNIT">Por Unidad (u)</SelectItem>
                                        <SelectItem value="MEASURE">Por Medida (m/ft)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Nombre</Label>
                            <Input id="name" name="name" defaultValue={product?.name} className="col-span-3" required />
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sku" className="text-right">SKU / Código</Label>
                            <Input id="sku" name="sku" defaultValue={product?.sku || ""} className="col-span-3" />
                        </div>

                        {/* Cost / Margin / Price Section */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="cost" className="text-right font-semibold">Costo Compra</Label>
                            <Input
                                id="cost"
                                name="cost"
                                type="number"
                                step="0.01"
                                value={cost}
                                onChange={(e) => handleCostChange(parseFloat(e.target.value) || 0)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="margin" className="text-right text-blue-600">% Ganancia</Label>
                            <div className="col-span-3 flex items-center gap-2">
                                <Input
                                    id="margin"
                                    type="number"
                                    step="0.1"
                                    value={margin}
                                    onChange={(e) => handleMarginChange(parseFloat(e.target.value) || 0)}
                                    className="w-24"
                                />
                                <span className="text-muted-foreground text-sm">%</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="price" className="text-right font-bold text-green-700">Precio Venta</Label>
                            <Input
                                id="price"
                                name="price"
                                type="number"
                                step="0.01"
                                value={price}
                                onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
                                className="col-span-3 font-bold"
                                required
                            />
                        </div>

                        {category !== "SERVICIO" && variants.length === 0 && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="stock" className="text-right">Stock</Label>
                                <Input id="stock" name="stock" type="number" defaultValue={product?.stock || 0} className="col-span-3" />
                            </div>
                        )}
                        {category === "SERVICIO" && <input type="hidden" name="stock" value="0" />}

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">Descripción</Label>
                            <Textarea id="description" name="description" defaultValue={product?.description || ""} className="col-span-3" />
                        </div>

                        {/* Variations Section */}
                        {category !== "SERVICIO" && (
                            <div className="border-t pt-4 mt-2">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-semibold text-sm">Variaciones (Talla, Color...)</h4>
                                    <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                                        Agregar Variación
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    {variants.map((variant, index) => (
                                        <div key={index} className="grid gap-2 border p-3 rounded bg-gray-50 relative">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute top-1 right-1 h-6 w-6 text-red-500"
                                                onClick={() => removeVariant(index)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <Label className="text-xs">Nombre (Ej: XL)</Label>
                                                    <Input
                                                        value={variant.name}
                                                        onChange={(e) => updateVariant(index, "name", e.target.value)}
                                                        placeholder="Nombre de la variación"
                                                        className="h-8 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs">SKU</Label>
                                                    <Input
                                                        value={variant.sku}
                                                        onChange={(e) => updateVariant(index, "sku", e.target.value)}
                                                        placeholder="SKU"
                                                        className="h-8 text-sm"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">Costo</Label>
                                                    <Input
                                                        type="number"
                                                        value={variant.cost}
                                                        onChange={(e) => updateVariant(index, "cost", parseFloat(e.target.value))}
                                                        className="h-8 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs font-bold text-green-700">Precio</Label>
                                                    <Input
                                                        type="number"
                                                        value={variant.price}
                                                        onChange={(e) => updateVariant(index, "price", parseFloat(e.target.value))}
                                                        className="h-8 text-sm font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs">Stock</Label>
                                                    <Input
                                                        type="number"
                                                        value={variant.stock}
                                                        onChange={(e) => updateVariant(index, "stock", parseInt(e.target.value))}
                                                        className="h-8 text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <SubmitButton isEdit={isEdit} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
