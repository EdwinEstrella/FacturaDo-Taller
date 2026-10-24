"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Boxes, Package, Wrench } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ProductDialog } from "@/components/modules/products/product-dialog"
import { DeleteProductButton } from "@/components/modules/products/delete-button"
import { EmptyList, SearchInput, SegmentedControl, StatTile, StatusPill } from "@/components/modules/shared/list-page"
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

type Filter = "ALL" | "PRODUCTS" | "SERVICES" | "LOW"

const isLow = (p: SerializedProduct) => !p.isService && Number(p.stock) <= Number(p.minStock)

export function ProductList({ products, canManageProducts }: ProductListProps) {
    const [search, setSearch] = useState("")
    const [filter, setFilter] = useState<Filter>("ALL")

    const counts = useMemo(() => ({
        ALL: products.length,
        PRODUCTS: products.filter((p) => !p.isService).length,
        SERVICES: products.filter((p) => p.isService).length,
        LOW: products.filter(isLow).length,
    }), [products])

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        return products.filter((p) => {
            if (filter === "PRODUCTS" && p.isService) return false
            if (filter === "SERVICES" && !p.isService) return false
            if (filter === "LOW" && !isLow(p)) return false
            if (!q) return true
            return [p.name, p.sku, p.category, p.description].some((v) => v?.toLowerCase().includes(q))
        })
    }, [products, search, filter])

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                <StatTile label="Productos" value={counts.PRODUCTS} hint="Artículos con inventario" icon={<Package />} tone="blue" />
                <StatTile label="Servicios" value={counts.SERVICES} hint="Mano de obra e instalación" icon={<Wrench />} tone="slate" />
                <StatTile
                    label="Stock bajo"
                    value={counts.LOW}
                    hint={counts.LOW ? "En o por debajo del mínimo" : "Todo en orden"}
                    icon={<AlertTriangle />}
                    tone={counts.LOW ? "red" : "green"}
                />
            </div>

            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Buscar por nombre, SKU o categoría..."
                        className="lg:max-w-md lg:flex-1"
                    />
                    <SegmentedControl
                        options={[
                            { value: "ALL" as Filter, label: "Todos", count: counts.ALL },
                            { value: "PRODUCTS" as Filter, label: "Productos", count: counts.PRODUCTS },
                            { value: "SERVICES" as Filter, label: "Servicios", count: counts.SERVICES },
                            { value: "LOW" as Filter, label: "Stock bajo", count: counts.LOW },
                        ]}
                        value={filter}
                        onChange={setFilter}
                    />
                </div>

                {visible.length === 0 ? (
                    <EmptyList
                        icon={<Boxes />}
                        title={products.length === 0 ? "Todavía no hay productos" : "Sin resultados"}
                        description={products.length === 0 ? "Agregá tu primer producto o servicio." : "Probá con otro nombre, SKU o filtro."}
                        action={products.length === 0 && canManageProducts ? <ProductDialog /> : undefined}
                    />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableHead className="pl-4">Producto / Servicio</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead className="text-right">Precio</TableHead>
                                <TableHead className="text-right">Existencia</TableHead>
                                {canManageProducts && <TableHead className="pr-4 text-right">Acciones</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visible.map((product) => {
                                const unit = getMeasurementShortLabel(getMeasurementModeFromProduct(product))
                                return (
                                    <TableRow key={product.id}>
                                        <TableCell className="max-w-[380px] py-3 pl-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${product.isService ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-600"}`}>
                                                    {product.isService ? <Wrench className="size-4" /> : <Package className="size-4" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium">{product.name}</p>
                                                    <p className="truncate font-mono text-xs text-muted-foreground">{product.sku || "Sin SKU"}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3 text-sm text-slate-600">{product.category || "—"}</TableCell>
                                        <TableCell className="py-3 text-right font-semibold tabular-nums">{formatCurrency(product.price)}</TableCell>
                                        <TableCell className="py-3 text-right">
                                            {product.isService ? (
                                                <span className="text-sm text-muted-foreground">Servicio</span>
                                            ) : isLow(product) ? (
                                                <StatusPill tone="red">{formatQuantity(product.stock)} {unit}</StatusPill>
                                            ) : (
                                                <span className="tabular-nums">{formatQuantity(product.stock)} <span className="text-muted-foreground">{unit}</span></span>
                                            )}
                                        </TableCell>
                                        {canManageProducts && (
                                            <TableCell className="py-3 pr-4">
                                                <div className="flex justify-end gap-1">
                                                    <ProductDialog product={product} />
                                                    <DeleteProductButton id={product.id} name={product.name} />
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    )
}
