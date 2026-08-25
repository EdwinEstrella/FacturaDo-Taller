"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ProductDialog } from "@/components/modules/products/product-dialog"
import { DeleteProductButton } from "@/components/modules/products/delete-button"
import { getMeasurementModeFromProduct, getMeasurementShortLabel } from "@/lib/product-measurements"
import { formatCurrency, formatQuantity } from "@/lib/utils"
import type { Product } from "@/types"

interface SerializedProduct extends Omit<Product, "price" | "cost"> {
    price: number
    cost: number
}

interface ProductListProps {
    products: SerializedProduct[]
    canManageProducts: boolean
}

export function ProductList({ products, canManageProducts }: ProductListProps) {
    const [search, setSearch] = useState("")
    const normalizedSearch = search.trim().toLowerCase()
    const filteredProducts = normalizedSearch
        ? products.filter((product) =>
            [product.name, product.sku, product.category, product.description]
                .some((value) => value?.toLowerCase().includes(normalizedSearch))
        )
        : products

    return (
        <>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
                <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Buscar productos y servicios"
                        className="pl-9"
                        placeholder="Buscar productos y servicios..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
                {search && (
                    <Button variant="ghost" size="sm" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">
                        <X className="mr-1 h-4 w-4" />
                        Limpiar
                    </Button>
                )}
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Precio</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.map((product) => (
                            <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{product.category}</Badge>
                                </TableCell>
                                <TableCell>{product.sku || "-"}</TableCell>
                                <TableCell>{formatCurrency(product.price)}</TableCell>
                                <TableCell>
                                    {product.isService ? (
                                        <span className="text-muted-foreground italic">Servicio</span>
                                    ) : (
                                        <span className={product.stock <= product.minStock ? "text-red-500 font-bold" : ""}>
                                            {formatQuantity(product.stock)} {getMeasurementShortLabel(getMeasurementModeFromProduct(product))}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="flex justify-end gap-2 text-right">
                                    {canManageProducts && (
                                        <>
                                            <ProductDialog product={product} />
                                            <DeleteProductButton id={product.id} name={product.name} />
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredProducts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    {products.length === 0 ? "No hay productos registrados." : "No hay productos ni servicios que coincidan con la búsqueda."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </>
    )
}
