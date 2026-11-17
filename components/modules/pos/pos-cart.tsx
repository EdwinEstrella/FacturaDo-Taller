"use client"

import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isMeasuredMode } from "@/lib/product-measurements"
import { formatCurrency } from "@/lib/utils"
import type { PosCartItem } from "./pos-types"

interface PosCartProps {
    items: PosCartItem[]
    onUpdateQuantity: (lineId: string, quantity: number | string) => void
    onUpdatePrice: (lineId: string, price: string) => void
    onRemoveItem: (lineId: string) => void
    onClearCart: () => void
}

export function PosCart({
    items,
    onUpdateQuantity,
    onUpdatePrice,
    onRemoveItem,
    onClearCart,
}: PosCartProps) {
    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-400 bg-white rounded-lg border border-slate-200">
                <ShoppingCart className="size-12 text-slate-300 mb-3" />
                <p className="font-semibold text-slate-700 text-sm">El carrito está vacío</p>
                <p className="text-xs text-slate-400 max-w-[220px] mt-1">
                    Hacé clic en los productos del catálogo para agregarlos a la venta.
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Carrito
                    </span>
                    <span className="bg-blue-100 text-blue-700 font-bold text-[11px] px-2 py-0.5 rounded-full">
                        {items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} items
                    </span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearCart}
                    className="h-7 text-xs text-slate-500 hover:text-rose-600 px-2"
                >
                    Vaciar
                </Button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1">
                {items.map((item) => {
                    const isMeasured = isMeasuredMode(item.measurementMode)
                    const lineTotal = item.price * Number(item.quantity || 0)

                    return (
                        <div key={item.lineId} className="p-2.5 hover:bg-slate-50/70 transition-colors space-y-2">
                            {/* Product Info */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-slate-800 leading-snug truncate">
                                        {item.productName}
                                    </p>
                                    {item.variantName && (
                                        <p className="text-[11px] text-indigo-600 font-medium truncate">
                                            {item.variantName}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onRemoveItem(item.lineId)}
                                    className="size-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                                    title="Quitar producto"
                                >
                                    <Trash2 className="size-3.5" />
                                </Button>
                            </div>

                            {/* Controls: Price + Quantity + Line Total */}
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                                {/* Editable Price */}
                                <div className="flex items-center gap-1">
                                    <span className="text-[11px] text-slate-400 font-medium">RD$</span>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="any"
                                        aria-label="Precio unitario"
                                        value={item.price}
                                        onChange={(e) => onUpdatePrice(item.lineId, e.target.value)}
                                        className="h-8 w-24 text-xs font-medium text-slate-800 bg-white px-2 text-right"
                                    />
                                </div>

                                {/* Quantity +/- Buttons */}
                                <div className="flex items-center border rounded-md bg-white shadow-xs">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const current = Number(item.quantity || 0)
                                            if (current <= 1) {
                                                onRemoveItem(item.lineId)
                                            } else {
                                                onUpdateQuantity(item.lineId, current - 1)
                                            }
                                        }}
                                        className="size-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-l-md transition-colors"
                                        title="Reducir cantidad"
                                    >
                                        <Minus className="size-3" />
                                    </button>
                                    <Input
                                        type="number"
                                        min={isMeasured ? "0.01" : "1"}
                                        step={isMeasured ? "0.01" : "1"}
                                        value={item.quantity}
                                        onChange={(e) => onUpdateQuantity(item.lineId, e.target.value)}
                                        className="h-8 w-12 border-0 text-center text-xs font-semibold focus-visible:ring-0 p-0"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const current = Number(item.quantity || 0)
                                            onUpdateQuantity(item.lineId, current + 1)
                                        }}
                                        className="size-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-r-md transition-colors"
                                        title="Aumentar cantidad"
                                    >
                                        <Plus className="size-3" />
                                    </button>
                                </div>

                                {/* Line Total */}
                                <div className="font-bold text-xs sm:text-sm text-slate-900 text-right min-w-[70px]">
                                    {formatCurrency(lineTotal)}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
