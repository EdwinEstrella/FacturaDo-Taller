"use client"

import { useMemo, useState } from "react"
import { Search, X, Layers, Wrench, Package } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import type { SerializedProduct } from "./pos-types"
import type { ProductVariant } from "@/types"

interface PosProductPickerProps {
    products: SerializedProduct[]
    onSelectProduct: (
        product: SerializedProduct,
        variant?: { id: string; name: string; price: number; stock: number }
    ) => void
}

const STOCK_DISPLAY_CAP = 100_000
const stockFormatter = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 })

/** Readable stock: large placeholder quantities (e.g. 1e+35) are shown as "100,000+". */
function formatStock(stock: number): string {
    if (stock >= STOCK_DISPLAY_CAP) return `${stockFormatter.format(STOCK_DISPLAY_CAP)}+`
    return stockFormatter.format(stock)
}

export function PosProductPicker({ products, onSelectProduct }: PosProductPickerProps) {
    const [search, setSearch] = useState("")
    const [selectedCategory, setSelectedCategory] = useState<string>("all")
    const [variantModalProduct, setVariantModalProduct] = useState<SerializedProduct | null>(null)

    // Extract unique categories
    const categories = useMemo(() => {
        const set = new Set<string>()
        for (const p of products) {
            if (p.category && p.category.trim()) {
                set.add(p.category.trim())
            }
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [products])

    // Filter products
    const filteredProducts = useMemo(() => {
        const query = search.toLowerCase().trim()
        return products.filter((product) => {
            const matchesCategory =
                selectedCategory === "all" ||
                (product.category && product.category.trim() === selectedCategory)

            if (!matchesCategory) return false

            if (!query) return true

            const nameMatch = product.name.toLowerCase().includes(query)
            const skuMatch = product.sku?.toLowerCase().includes(query)
            const variantMatch = product.variants?.some(
                (v) =>
                    v.name.toLowerCase().includes(query) ||
                    v.sku?.toLowerCase().includes(query)
            )

            return Boolean(nameMatch || skuMatch || variantMatch)
        })
    }, [products, search, selectedCategory])

    const handleProductClick = (product: SerializedProduct) => {
        if (product.hasVariants && product.variants && product.variants.length > 0) {
            setVariantModalProduct(product)
        } else {
            onSelectProduct(product)
        }
    }

    const handleSelectVariant = (product: SerializedProduct, variant: ProductVariant) => {
        onSelectProduct(product, {
            id: variant.id,
            name: variant.name,
            price: Number(variant.price),
            stock: Number(variant.stock || 0),
        })
        setVariantModalProduct(null)
    }

    return (
        <div className="flex flex-col h-full space-y-3">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                    type="search"
                    placeholder="Buscar producto por nombre, código o barra..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-9 h-11 bg-white text-base shadow-sm"
                />
                {search && (
                    <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title="Limpiar búsqueda"
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>

            {/* Category Filter Pills */}
            {categories.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-sm">
                    <button
                        type="button"
                        onClick={() => setSelectedCategory("all")}
                        className={`px-3 py-1.5 rounded-full font-medium shrink-0 transition-colors ${
                            selectedCategory === "all"
                                ? "bg-slate-900 text-white shadow-sm"
                                : "bg-white border text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                        Todos ({products.length})
                    </button>
                    {categories.map((cat) => {
                        const count = products.filter((p) => p.category?.trim() === cat).length
                        const isSelected = selectedCategory === cat
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-full font-medium shrink-0 transition-colors ${
                                    isSelected
                                        ? "bg-slate-900 text-white shadow-sm"
                                        : "bg-white border text-slate-600 hover:bg-slate-100"
                                }`}
                            >
                                {cat} ({count})
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto pr-1">
                {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500">
                        <Package className="size-10 text-slate-300 mb-2" />
                        <p className="text-sm font-medium">No se encontraron productos</p>
                        <p className="text-xs text-slate-400">Probá con otro término de búsqueda o categoría</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                        {filteredProducts.map((product) => {
                            const isService = Boolean(product.isService)
                            const stock = Number(product.stock ?? 0)
                            const isOutOfStock = !isService && stock <= 0
                            const hasVariants = Boolean(product.hasVariants && product.variants?.length)

                            return (
                                <Card
                                    key={product.id}
                                    onClick={() => handleProductClick(product)}
                                    className={`p-4 min-h-[140px] cursor-pointer flex flex-col justify-between gap-3 transition-all select-none border border-slate-200/90 hover:border-blue-500 hover:shadow-md bg-white active:scale-[0.98] ${
                                        isOutOfStock ? "bg-slate-50/70 opacity-80" : ""
                                    }`}
                                >
                                    <div className="space-y-1 min-w-0">
                                        <p className="font-semibold text-sm text-slate-800 line-clamp-2 leading-snug" title={product.name}>
                                            {product.name}
                                        </p>
                                        {product.sku && (
                                            <p className="text-xs text-slate-400 truncate">
                                                SKU: {product.sku}
                                            </p>
                                        )}
                                    </div>

                                    <div className="pt-3 border-t border-slate-100 space-y-1.5 min-w-0">
                                        <div className="font-bold text-lg text-blue-600 truncate">
                                            {formatCurrency(product.price)}
                                        </div>
                                        <div className="truncate">
                                            {isService ? (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-200 text-blue-700 bg-blue-50">
                                                    <Wrench className="size-2.5 mr-1" />
                                                    Servicio
                                                </Badge>
                                            ) : hasVariants ? (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-indigo-200 text-indigo-700 bg-indigo-50">
                                                    <Layers className="size-2.5 mr-1" />
                                                    {product.variants?.length} var.
                                                </Badge>
                                            ) : isOutOfStock ? (
                                                <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                                    Agotado
                                                </span>
                                            ) : (
                                                <span className="text-xs font-medium text-slate-500">
                                                    Stock: <span className="text-slate-800 font-semibold">{formatStock(stock)}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Variant Picker Dialog */}
            <Dialog open={!!variantModalProduct} onOpenChange={(open) => !open && setVariantModalProduct(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">
                            Seleccionar variante: {variantModalProduct?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pt-2">
                        {variantModalProduct?.variants?.map((variant) => (
                            <button
                                key={variant.id}
                                type="button"
                                onClick={() => handleSelectVariant(variantModalProduct, variant)}
                                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all text-left"
                            >
                                <div>
                                    <p className="font-medium text-sm text-slate-800">{variant.name}</p>
                                    {variant.sku && (
                                        <p className="text-xs text-slate-400">SKU: {variant.sku}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-sm text-blue-600">
                                        {formatCurrency(Number(variant.price))}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Stock: {variant.stock ?? 0}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
