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
import { Edit } from "lucide-react"

function SubmitButton({ isEdit }: { isEdit: boolean }) {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : (isEdit ? "Actualizar" : "Guardar Producto")}
        </Button>
    )
}

export function ProductDialog({ product }: { product?: Product }) {
    const [open, setOpen] = useState(false)
    const isEdit = !!product
    const [category, setCategory] = useState(product?.category || "ARTICULO")

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {isEdit ? (
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                ) : (
                    <Button>Agregar Producto</Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Editar Producto" : "Agregar Producto"}</DialogTitle>
                    <DialogDescription>
                        Detalles del producto.
                    </DialogDescription>
                </DialogHeader>
                <form action={async (formData) => {
                    if (isEdit && product) {
                        await updateProduct(product.id, null, formData)
                    } else {
                        await createProduct(null, formData)
                    }
                    setOpen(false)
                }}>
                    <div className="grid gap-4 py-4">
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
                            <Label htmlFor="name" className="text-right">Nombre</Label>
                            <Input id="name" name="name" defaultValue={product?.name} className="col-span-3" required />
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sku" className="text-right">SKU / Código</Label>
                            <Input id="sku" name="sku" defaultValue={product?.sku || ""} className="col-span-3" />
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="price" className="text-right">Precio</Label>
                            <Input id="price" name="price" type="number" step="0.01" defaultValue={Number(product?.price || 0)} className="col-span-3" required />
                        </div>

                        {category !== "SERVICIO" && (
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
                    </div>
                    <DialogFooter>
                        <SubmitButton isEdit={isEdit} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
