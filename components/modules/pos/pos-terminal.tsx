"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { createInvoice, getInvoiceById } from "@/actions/invoice-actions"
import { computeEcfTotals, computeNoReceiptTotals } from "@/lib/fiscal/issuance/totals"
import { resolveEcfType, isServiceProduct } from "@/lib/fiscal/issuance/buyer"
import { mapIssuanceErrorToSpanish } from "@/lib/fiscal/issuance/errors"
import type { InvoiceLineSnapshot } from "@/lib/fiscal/issuance/types"
import { getMeasurementModeFromProduct, isMeasuredMode } from "@/lib/product-measurements"
import { useShiftGuard } from "@/components/modules/cash-close/closed-shift-dialog"
import { PosProductPicker } from "./pos-product-picker"
import { PosCart } from "./pos-cart"
import { PosSummary } from "./pos-summary"
import { PosSuccessDialog } from "./pos-success-dialog"
import type { PosCartItem, PosInvoice, PosTerminalProps, SerializedProduct } from "./pos-types"

function createLineId() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
}

function findDefaultClientId(clients: PosTerminalProps["initialClients"]): string {
    if (!clients || clients.length === 0) return ""

    const walkInClient = clients.find((c) => {
        const name = c.name.toLowerCase().trim()
        return (
            name.includes("consumidor final") ||
            name.includes("cliente general") ||
            name.includes("contado")
        )
    })

    return walkInClient ? walkInClient.id : ""
}

export function PosTerminal({
    initialProducts,
    initialClients,
    ecfEnabled,
    settings,
}: PosTerminalProps) {
    const { requireShift } = useShiftGuard()
    const [isPending, startTransition] = useTransition()

    // Default client is preselected
    const defaultClientId = useMemo(() => findDefaultClientId(initialClients), [initialClients])
    const [selectedClientId, setSelectedClientId] = useState<string>(defaultClientId)

    // State
    const [items, setItems] = useState<PosCartItem[]>([])
    const [withoutFiscalReceipt, setWithoutFiscalReceipt] = useState<boolean>(true)
    const [paymentMethod, setPaymentMethod] = useState<string>("CASH")
    const [amountTendered, setAmountTendered] = useState<number>(0)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    // Success dialog state
    const [successInvoice, setSuccessInvoice] = useState<PosInvoice | null>(null)
    const [completedSale, setCompletedSale] = useState<{ invoiceId: string; total: number } | null>(null)
    const [showSuccessDialog, setShowSuccessDialog] = useState(false)

    // Product lookup map
    const productMap = useMemo(() => {
        const map = new Map<string, SerializedProduct>()
        for (const p of initialProducts) {
            map.set(p.id, p)
        }
        return map
    }, [initialProducts])

    // Selected client
    const selectedClient = useMemo(() => {
        return initialClients.find((c) => c.id === selectedClientId)
    }, [initialClients, selectedClientId])

    // e-CF type resolution
    const clientEcfType = useMemo(() => {
        return resolveEcfType(selectedClient)
    }, [selectedClient])

    const fiscalReceiptDescription = ecfEnabled
        ? `Se emitirá comprobante electrónico (${clientEcfType === "E31" ? "Crédito fiscal (E31)" : "Consumo (E32)"}) y se enviará a la DGII`
        : "Se emitirá comprobante fiscal B01 (crédito fiscal). El cliente debe tener RNC."

    // Subtotal
    const subtotal = useMemo(() => {
        return items.reduce((sum, item) => sum + item.price * Number(item.quantity || 0), 0)
    }, [items])

    // Totals calculation with identical parity to invoice-form
    const totalsCalculation = useMemo(() => {
        if (withoutFiscalReceipt) {
            const noReceipt = computeNoReceiptTotals(subtotal, {
                shipping: 0,
                discount: 0,
            })
            return {
                taxAmount: noReceipt.tax,
                activeDiscount: noReceipt.discount,
                total: noReceipt.total,
                error: null as string | null,
            }
        }

        if (ecfEnabled) {
            if (items.length === 0) {
                return {
                    taxAmount: 0,
                    activeDiscount: 0,
                    total: 0,
                    error: null as string | null,
                }
            }

            const mapperLines: InvoiceLineSnapshot[] = items.map((item) => {
                const product = productMap.get(item.productId)
                const isService = isServiceProduct(product)
                return {
                    name: item.productName || (product?.name ?? "Artículo"),
                    quantity: Number(item.quantity || 0),
                    unitPrice: Number(item.price || 0),
                    taxable: !isService,
                    isService,
                }
            })

            try {
                const computed = computeEcfTotals(mapperLines, {
                    shipping: 0,
                    discount: 0,
                })
                return {
                    taxAmount: computed.itbisAmount,
                    activeDiscount: 0,
                    total: computed.totalAmount,
                    error: null as string | null,
                }
            } catch (err) {
                return {
                    taxAmount: 0,
                    activeDiscount: 0,
                    total: 0,
                    error: mapIssuanceErrorToSpanish(err),
                }
            }
        }

        // Legacy NCF (B01) mode: calculate standard 18% ITBIS on non-service products
        const taxableSubtotal = items.reduce((acc, item) => {
            const product = productMap.get(item.productId)
            const isService = isServiceProduct(product)
            if (isService) return acc
            return acc + item.price * Number(item.quantity || 0)
        }, 0)

        const taxAmount = taxableSubtotal * 0.18
        const total = subtotal + taxAmount

        return {
            taxAmount,
            activeDiscount: 0,
            total,
            error: null as string | null,
        }
    }, [ecfEnabled, withoutFiscalReceipt, subtotal, items, productMap])

    // Add item to cart
    const handleSelectProduct = (
        product: SerializedProduct,
        variant?: { id: string; name: string; price: number; stock: number }
    ) => {
        setErrorMessage(null)
        const measurementMode = getMeasurementModeFromProduct(product)
        const price = variant ? variant.price : Number(product.price)
        const name = variant ? `${product.name} - ${variant.name}` : product.name
        const stock = variant ? variant.stock : Number(product.stock ?? 0)
        const variantId = variant?.id || undefined

        setItems((current) => {
            const existingIndex = current.findIndex(
                (item) => item.productId === product.id && item.variantId === variantId
            )

            if (existingIndex > -1) {
                return current.map((item, index) => {
                    if (index !== existingIndex) return item
                    return {
                        ...item,
                        quantity: Number(item.quantity || 0) + 1,
                    }
                })
            }

            return [
                ...current,
                {
                    lineId: createLineId(),
                    productId: product.id,
                    productName: name,
                    price,
                    quantity: 1,
                    measurementMode,
                    variantId,
                    variantName: variant?.name,
                    stock,
                    isService: Boolean(product.isService),
                },
            ]
        })
    }

    // Update quantity
    const handleUpdateQuantity = (lineId: string, value: number | string) => {
        setErrorMessage(null)
        setItems((current) =>
            current.map((item) => {
                if (item.lineId !== lineId) return item

                if (value === "") {
                    return { ...item, quantity: 1 }
                }

                const q = Number(value)
                if (Number.isNaN(q) || q <= 0) return item

                if (!isMeasuredMode(item.measurementMode) && !Number.isInteger(q)) {
                    return item
                }

                return { ...item, quantity: q }
            })
        )
    }

    // Update price
    const handleUpdatePrice = (lineId: string, value: string) => {
        setErrorMessage(null)
        setItems((current) =>
            current.map((item) => {
                if (item.lineId !== lineId) return item

                if (value === "") {
                    return { ...item, price: 0 }
                }

                const parsed = Number(value)
                if (!Number.isFinite(parsed) || parsed < 0) {
                    return item
                }

                return { ...item, price: parsed }
            })
        )
    }

    // Remove line item
    const handleRemoveItem = (lineId: string) => {
        setErrorMessage(null)
        setItems((current) => current.filter((item) => item.lineId !== lineId))
    }

    // Clear cart
    const handleClearCart = () => {
        setErrorMessage(null)
        setItems([])
    }

    // Reset whole sale
    const handleNewSale = () => {
        setItems([])
        setAmountTendered(0)
        setPaymentMethod("CASH")
        setWithoutFiscalReceipt(true) // Switch back ON
        setSelectedClientId(defaultClientId)
        setErrorMessage(null)
        setSuccessInvoice(null)
        setCompletedSale(null)
        setShowSuccessDialog(false)
    }

    // Checkout
    const handleCheckout = () => {
        setErrorMessage(null)

        if (!requireShift()) return

        if (items.length === 0) {
            setErrorMessage("El carrito está vacío. Agregá al menos un producto.")
            return
        }

        if (!selectedClient) {
            setErrorMessage("Seleccione un cliente válido para continuar.")
            return
        }

        if (!ecfEnabled && !withoutFiscalReceipt && !selectedClient.rnc?.trim()) {
            setErrorMessage("El cliente no tiene RNC. Seleccione un cliente con RNC para emitir comprobante fiscal (B01).")
            return
        }

        if (totalsCalculation.error) {
            setErrorMessage(totalsCalculation.error)
            return
        }

        startTransition(async () => {
            const parsedItems = items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: Number(item.quantity || 0),
                price: Number(item.price || 0),
                variantId: item.variantId || undefined,
                characteristics: [],
            }))

            const payload = {
                clientId: selectedClient.id,
                clientName: selectedClient.name,
                items: parsedItems,
                total: totalsCalculation.total,
                paymentMethod,
                shippingCost: 0,
                discount: totalsCalculation.activeDiscount,
                notes: "",
                amountPaid:
                    paymentMethod === "CREDIT"
                        ? 0
                        : amountTendered > 0
                        ? amountTendered
                        : undefined,
                tax: totalsCalculation.taxAmount,
                hasNcf: !withoutFiscalReceipt && totalsCalculation.taxAmount > 0,
                withoutFiscalReceipt,
            }

            const res = await createInvoice(payload)

            if (res.success && res.invoiceId) {
                toast.success("¡Venta completada con éxito!")

                const invoiceId = res.invoiceId
                const total = totalsCalculation.total
                setCompletedSale({ invoiceId, total })

                // Load enriched invoice record for printing
                try {
                    const fullInvoice = await getInvoiceById(invoiceId)
                    setSuccessInvoice(fullInvoice || null)
                } catch {
                    setSuccessInvoice(null)
                }

                setShowSuccessDialog(true)
            } else {
                if (
                    res.error?.includes("turno de caja") ||
                    res.error?.includes("apertura de caja")
                ) {
                    requireShift()
                } else {
                    setErrorMessage(res.error || "Error al procesar la venta.")
                }
            }
        })
    }

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-full min-h-0">
            {/* Left side: Product Catalog & Search */}
            <div className="flex-1 min-w-0 bg-white/60 p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col h-[500px] lg:h-full overflow-hidden">
                <PosProductPicker
                    products={initialProducts}
                    onSelectProduct={handleSelectProduct}
                />
            </div>

            {/* Right side: Cart & Checkout Summary */}
            <div className="w-full lg:w-[480px] xl:w-[520px] shrink-0 flex flex-col gap-3 h-full overflow-y-auto">
                {/* Cart list (takes flexible height) */}
                <div className="flex-1 min-h-[220px] max-h-[360px] lg:max-h-none">
                    <PosCart
                        items={items}
                        onUpdateQuantity={handleUpdateQuantity}
                        onUpdatePrice={handleUpdatePrice}
                        onRemoveItem={handleRemoveItem}
                        onClearCart={handleClearCart}
                    />
                </div>

                {/* Checkout Summary & Action */}
                <div className="shrink-0">
                    <PosSummary
                        clients={initialClients}
                        selectedClientId={selectedClientId}
                        onSelectClient={setSelectedClientId}
                        withoutFiscalReceipt={withoutFiscalReceipt}
                        onToggleWithoutFiscalReceipt={setWithoutFiscalReceipt}
                        fiscalReceiptDescription={fiscalReceiptDescription}
                        paymentMethod={paymentMethod}
                        onChangePaymentMethod={setPaymentMethod}
                        amountTendered={amountTendered}
                        onChangeAmountTendered={setAmountTendered}
                        subtotal={subtotal}
                        taxAmount={totalsCalculation.taxAmount}
                        total={totalsCalculation.total}
                        totalsError={totalsCalculation.error}
                        errorMessage={errorMessage}
                        isPending={isPending}
                        cartItemCount={items.length}
                        onCheckout={handleCheckout}
                    />
                </div>
            </div>

            {/* Success & Print Dialog */}
            <PosSuccessDialog
                isOpen={showSuccessDialog}
                invoice={successInvoice}
                completedSale={completedSale}
                settings={settings}
                onNewSale={handleNewSale}
            />
        </div>
    )
}
