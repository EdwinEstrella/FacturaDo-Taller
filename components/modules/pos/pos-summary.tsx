"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, User, AlertCircle, Banknote, CreditCard, ArrowRightLeft, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import { ClientDialog } from "@/components/modules/clients/client-dialog"
import { formatCurrency } from "@/lib/utils"
import type { Client } from "@/types"
import type { PosSaleDetails } from "./pos-types"

interface PosSummaryProps {
    clients: Client[]
    selectedClientId: string
    onSelectClient: (clientId: string) => void
    withoutFiscalReceipt: boolean
    onToggleWithoutFiscalReceipt: (value: boolean) => void
    fiscalReceiptDescription: string
    fiscalReceiptHint: string | null
    saleDetails: PosSaleDetails
    onChangeSaleDetails: (patch: Partial<PosSaleDetails>) => void
    installationAvailable: boolean
    paymentMethod: string
    onChangePaymentMethod: (method: string) => void
    amountTendered: number
    onChangeAmountTendered: (amount: number) => void
    subtotal: number
    taxAmount: number
    total: number
    totalsError: string | null
    errorMessage: string | null
    isPending: boolean
    cartItemCount: number
    onCheckout: () => void
}

const PAYMENT_OPTIONS = [
    { id: "CASH", label: "Efectivo", icon: Banknote },
    { id: "TRANSFER", label: "Transferencia", icon: ArrowRightLeft },
    { id: "CARD", label: "Tarjeta", icon: CreditCard },
    { id: "CREDIT", label: "Crédito", icon: FileSpreadsheet },
]

export function PosSummary({
    clients,
    selectedClientId,
    onSelectClient,
    withoutFiscalReceipt,
    onToggleWithoutFiscalReceipt,
    fiscalReceiptDescription,
    fiscalReceiptHint,
    saleDetails,
    onChangeSaleDetails,
    installationAvailable,
    paymentMethod,
    onChangePaymentMethod,
    amountTendered,
    onChangeAmountTendered,
    subtotal,
    taxAmount,
    total,
    totalsError,
    errorMessage,
    isPending,
    cartItemCount,
    onCheckout,
}: PosSummaryProps) {
    const [openClient, setOpenClient] = useState(false)

    const selectedClient = clients.find((c) => c.id === selectedClientId)
    const change = paymentMethod === "CASH" && amountTendered > total ? amountTendered - total : 0

    const toAmount = (value: string) => {
        const parsed = Number(value)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    }

    const quickCashAdd = (add: number) => {
        onChangeAmountTendered((amountTendered || 0) + add)
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-5">
            {/* Client Selector */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Cliente
                    </Label>
                    <div className="flex items-center gap-2">
                        {selectedClient && (selectedClient.rnc || selectedClient.cedula) && (
                            <span className="text-xs text-slate-500 font-mono">
                                {selectedClient.rnc ? `RNC: ${selectedClient.rnc}` : `Céd: ${selectedClient.cedula}`}
                            </span>
                        )}
                        <ClientDialog />
                    </div>
                </div>
                <Popover open={openClient} onOpenChange={setOpenClient}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openClient}
                            className="w-full justify-between h-11 text-sm font-normal bg-slate-50 border-slate-200"
                        >
                            <span className="flex items-center gap-2 truncate">
                                <User className="size-3.5 text-slate-500 shrink-0" />
                                <span className="truncate font-medium text-slate-800">
                                    {selectedClient ? selectedClient.name : "Seleccionar cliente..."}
                                </span>
                            </span>
                            <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Buscar cliente por nombre o RNC..." className="h-9 text-xs" />
                            <CommandList>
                                <CommandEmpty>No se encontró cliente.</CommandEmpty>
                                <CommandGroup>
                                    {clients.map((client) => {
                                        const isSelected = selectedClientId === client.id
                                        return (
                                            <CommandItem
                                                key={client.id}
                                                value={`${client.name} ${client.rnc || ""} ${client.cedula || ""}`}
                                                onSelect={() => {
                                                    onSelectClient(client.id)
                                                    setOpenClient(false)
                                                }}
                                                className="text-xs flex items-center justify-between"
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <p className="font-medium text-slate-800 truncate">{client.name}</p>
                                                    {(client.rnc || client.cedula) && (
                                                        <p className="text-[10px] text-slate-400 font-mono">
                                                            {client.rnc || client.cedula}
                                                        </p>
                                                    )}
                                                </div>
                                                <Check className={`size-3.5 shrink-0 ${isSelected ? "opacity-100 text-blue-600" : "opacity-0"}`} />
                                            </CommandItem>
                                        )
                                    })}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Prominent "Sin comprobante" Switch */}
            <div className={`p-3 rounded-lg border transition-all ${
                withoutFiscalReceipt
                    ? "bg-amber-50/60 border-amber-200/80"
                    : "bg-blue-50/60 border-blue-200/80"
            }`}>
                <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                        <Label
                            htmlFor="without-receipt-switch"
                            className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5"
                        >
                            Sin comprobante
                        </Label>
                        <p className="text-[11px] leading-tight font-medium">
                            {withoutFiscalReceipt ? (
                                <span className="text-amber-800">No se emite comprobante fiscal</span>
                            ) : (
                                <span className="text-blue-800">{fiscalReceiptDescription}</span>
                            )}
                        </p>
                    </div>
                    <Switch
                        id="without-receipt-switch"
                        checked={withoutFiscalReceipt}
                        onCheckedChange={onToggleWithoutFiscalReceipt}
                    />
                </div>
                {withoutFiscalReceipt && (
                    <label className="mt-2.5 flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                        <Checkbox
                            checked={saleDetails.applyTax}
                            onCheckedChange={(checked) => onChangeSaleDetails({ applyTax: checked === true })}
                        />
                        Aplicar ITBIS (18%)
                    </label>
                )}
                {!withoutFiscalReceipt && fiscalReceiptHint && (
                    <p className="mt-2 text-xs font-medium text-amber-800">{fiscalReceiptHint}</p>
                )}
            </div>

            {/* Sale details: installation, shipping, discount, delivery date, notes */}
            <div className="space-y-3 rounded-lg border border-slate-200 p-3.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Detalles de la venta
                </Label>

                {installationAvailable && (
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                            <Checkbox
                                checked={saleDetails.includeInstallation}
                                onCheckedChange={(checked) =>
                                    onChangeSaleDetails({
                                        includeInstallation: checked === true,
                                        installationAmount: checked === true ? saleDetails.installationAmount : 0,
                                    })
                                }
                            />
                            Incluye instalación
                        </label>
                        {saleDetails.includeInstallation && (
                            <Input
                                type="number"
                                min="0"
                                step="any"
                                autoFocus
                                aria-label="Monto de la instalación"
                                placeholder="Monto de la instalación (RD$)"
                                value={saleDetails.installationAmount || ""}
                                onChange={(e) => onChangeSaleDetails({ installationAmount: toAmount(e.target.value) })}
                                className="h-10"
                            />
                        )}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="pos-shipping" className="text-xs text-slate-600">Costo de envío</Label>
                        <Input
                            id="pos-shipping"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={saleDetails.shippingCost || ""}
                            onChange={(e) => onChangeSaleDetails({ shippingCost: toAmount(e.target.value) })}
                            className="h-10"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="pos-discount" className="text-xs text-slate-600">Descuento</Label>
                        <Input
                            id="pos-discount"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={saleDetails.discount || ""}
                            onChange={(e) => onChangeSaleDetails({ discount: toAmount(e.target.value) })}
                            className="h-10"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Fecha de entrega</Label>
                    <DatePicker
                        date={saleDetails.deliveryDate}
                        setDate={(date) => onChangeSaleDetails({ deliveryDate: date })}
                    />
                </div>

                <div className="space-y-1">
                    <Label htmlFor="pos-notes" className="text-xs text-slate-600">Notas / Observaciones</Label>
                    <Textarea
                        id="pos-notes"
                        rows={2}
                        value={saleDetails.notes}
                        onChange={(e) => onChangeSaleDetails({ notes: e.target.value })}
                    />
                </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Método de Pago
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                    {PAYMENT_OPTIONS.map((opt) => {
                        const Icon = opt.icon
                        const isSelected = paymentMethod === opt.id
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => onChangePaymentMethod(opt.id)}
                                className={`flex items-center gap-2 px-2.5 py-2 rounded-md border text-xs font-medium transition-all ${
                                    isSelected
                                        ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                }`}
                            >
                                <Icon className="size-3.5 shrink-0" />
                                <span className="truncate">{opt.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Cash Tendered & Change (if CASH) */}
            {paymentMethod === "CASH" && (
                <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/40 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="tendered-amount" className="text-xs font-bold text-emerald-900">
                            Monto Recibido
                        </Label>
                        <button
                            type="button"
                            onClick={() => onChangeAmountTendered(total)}
                            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline"
                        >
                            Exacto
                        </button>
                    </div>

                    <Input
                        id="tendered-amount"
                        type="number"
                        min="0"
                        step="any"
                        placeholder={total > 0 ? total.toString() : "0"}
                        value={amountTendered || ""}
                        onChange={(e) => onChangeAmountTendered(Number(e.target.value))}
                        className="h-9 bg-white text-sm font-semibold text-slate-900"
                    />

                    {/* Quick Add Buttons */}
                    <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
                        {[100, 500, 1000, 2000].map((amt) => (
                            <button
                                key={amt}
                                type="button"
                                onClick={() => quickCashAdd(amt)}
                                className="px-2 py-1 bg-white border border-emerald-200 rounded text-emerald-800 font-medium hover:bg-emerald-100 transition-colors shrink-0"
                            >
                                +{amt}
                            </button>
                        ))}
                    </div>

                    {/* Devuelta */}
                    <div className="flex items-center justify-between pt-1 border-t border-emerald-200/70">
                        <span className="text-xs font-bold text-emerald-800">Devuelta:</span>
                        <span className="text-sm font-black text-emerald-700">
                            {formatCurrency(change)}
                        </span>
                    </div>
                </div>
            )}

            {/* Totals Breakdown */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200 text-sm">
                <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-medium text-slate-800">{formatCurrency(subtotal)}</span>
                </div>
                {saleDetails.shippingCost > 0 && (
                    <div className="flex justify-between text-slate-600">
                        <span>Envío</span>
                        <span className="font-medium text-slate-800">{formatCurrency(saleDetails.shippingCost)}</span>
                    </div>
                )}
                {saleDetails.discount > 0 && (
                    <div className="flex justify-between text-slate-600">
                        <span>Descuento</span>
                        <span className="font-medium text-rose-600">-{formatCurrency(Math.min(saleDetails.discount, subtotal))}</span>
                    </div>
                )}
                <div className="flex justify-between text-slate-600">
                    <span>ITBIS (18%)</span>
                    <span className="font-medium text-slate-800">
                        {formatCurrency(taxAmount)}
                    </span>
                </div>
                <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-100 text-slate-900">
                    <span className="text-base font-bold">Total</span>
                    <span className="text-xl font-black text-blue-600">{formatCurrency(total)}</span>
                </div>
            </div>

            {/* Error alerts if any */}
            {(totalsError || errorMessage) && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{totalsError || errorMessage}</span>
                </div>
            )}

            {/* Big "Cobrar" Button */}
            <Button
                size="lg"
                disabled={isPending || cartItemCount === 0 || !!totalsError}
                onClick={onCheckout}
                className="w-full h-13 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-[0.99] transition-all"
            >
                {isPending ? "Procesando venta..." : `Cobrar ${formatCurrency(total)}`}
            </Button>
        </div>
    )
}
