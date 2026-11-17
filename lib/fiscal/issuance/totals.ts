// Pure calculation functions for e-CF totals and line-item financial balancing.
// Dependency-free: safe to import from client components or server actions (no Node.js/XML imports).

import { IssuanceError } from "./errors"
import type {
    ComputedEcfLine,
    ComputedEcfTotals,
    InvoiceLineSnapshot,
} from "./types"

/**
 * Rounds a monetary or quantity number to 2 decimal places using half-up arithmetic.
 * Adding EPSILON avoids floating point precision truncation (e.g. 1.005 -> 1.01).
 */
export function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Rounds a unit price to 4 decimal places using half-up arithmetic.
 * DGII accepts PrecioUnitarioItem up to 4 decimal places (Decimal(14,4)).
 */
export function round4(value: number): number {
    return Math.round((value + Number.EPSILON) * 10000) / 10000
}

export interface ComputeEcfTotalsOptions {
    shipping?: number | null
    discount?: number | null
}

export interface ComputeNoReceiptTotalsOptions {
    shipping?: number | null
    discount?: number | null
    /**
     * Gross of the taxable (non-service) lines when the cashier chose "Aplicar ITBIS".
     * Omitted or null: the sale carries no ITBIS.
     */
    itbisBase?: number | null
}

export interface ComputedNoReceiptTotals {
    subtotal: number
    tax: number
    shipping: number
    discount: number
    total: number
}

/**
 * Single shared formula for "Sin comprobante" (no fiscal receipt) totals:
 * items gross + shipping − discount capped at items gross, plus 18% ITBIS on `itbisBase`
 * when given (0 otherwise).
 * Shipping is never discounted. Discount cannot exceed items gross.
 */
const NO_RECEIPT_ITBIS_RATE = 0.18

export function computeNoReceiptTotals(
    itemsGross: number,
    options?: ComputeNoReceiptTotalsOptions
): ComputedNoReceiptTotals {
    const gross = round2(Math.max(0, itemsGross))
    const shipping = round2(Math.max(0, Number(options?.shipping || 0)))
    const rawDiscount = round2(Math.max(0, Number(options?.discount || 0)))
    const cappedDiscount = Math.min(rawDiscount, gross)
    const tax = options?.itbisBase == null ? 0 : round2(Math.max(0, Number(options.itbisBase)) * NO_RECEIPT_ITBIS_RATE)
    const total = round2(gross + shipping - cappedDiscount + tax)

    return {
        subtotal: gross,
        tax,
        shipping,
        discount: cappedDiscount,
        total,
    }
}

/**
 * Computes deterministic e-CF fiscal totals and balanced lines.
 *
 * Rules:
 * 1. Decimal precision: Quantity is rounded to 2 decimal places (DGII CantidadItem: Decimal(12,2))
 *    and unit price is rounded to 4 decimal places (DGII PrecioUnitarioItem: Decimal(14,4)) FIRST.
 * 2. Global discount proration:
 *    The app stores a single global discount on the invoice. DGII requires discounts to be assigned
 *    per line as `DescuentoMonto`.
 *    The discount is prorated proportionally across item lines based on their gross amount (qty * unitPrice):
 *      lineDiscount_i = round2(globalDiscount * lineGross_i / grossSum)
 *    The LAST item line absorbs the rounding remainder so that sum(lineDiscounts) === globalDiscount exactly.
 *    If globalDiscount exceeds grossSum, IssuanceError("DISCOUNT_EXCEEDS_ITEMS") is thrown.
 * 3. ITBIS base:
 *    ITBIS is computed strictly on the discounted taxable base: round2(taxableAmount * 0.18),
 *    where taxableAmount is the exact sum of discounted taxable line amounts (MontoItem).
 * 4. Shipping:
 *    Shipping (if > 0) is ALWAYS appended as one exempt service line named 'Envío'.
 *    Shipping is never discounted (the caller never puts shipping in `lines`, and discount belongs to items).
 * 5. Line Amount:
 *    Each item line's MontoItem = round2(roundedQty * roundedPrice - lineDiscount).
 */
export function computeEcfTotals(
    lines: InvoiceLineSnapshot[],
    options?: ComputeEcfTotalsOptions
): ComputedEcfTotals {
    if (!Array.isArray(lines) || lines.length === 0) {
        throw new IssuanceError("EMPTY_ITEMS", "Invoice must contain at least one line item.")
    }

    const rawLines = lines.map((line, idx) => {
        const name = (line.name || "").trim()
        if (!name) {
            throw new IssuanceError("INVALID_ITEM", `Line item ${idx + 1} must have a name.`)
        }
        const rawQty = Number(line.quantity)
        if (!Number.isFinite(rawQty) || rawQty <= 0) {
            throw new IssuanceError("INVALID_ITEM", `Line item ${idx + 1} has invalid quantity: ${line.quantity}`)
        }
        const rawPrice = Number(line.unitPrice)
        if (!Number.isFinite(rawPrice) || rawPrice < 0) {
            throw new IssuanceError("INVALID_ITEM", `Line item ${idx + 1} has invalid unitPrice: ${line.unitPrice}`)
        }

        const roundedQty = round2(rawQty)
        if (roundedQty <= 0) {
            throw new IssuanceError("INVALID_ITEM", `Line item ${idx + 1} quantity rounds to zero or negative: ${line.quantity}`)
        }
        const roundedPrice = round4(rawPrice)
        const lineGross = round2(roundedQty * roundedPrice)

        return {
            name,
            quantity: roundedQty,
            unitPrice: roundedPrice,
            lineGross,
            taxable: Boolean(line.taxable),
            isService: Boolean(line.isService),
            unitMeasure: line.unitMeasure?.trim() || null,
        }
    })

    const globalDiscount = round2(Number(options?.discount || 0))
    if (globalDiscount < 0) {
        throw new IssuanceError("INVALID_DISCOUNT", `Discount cannot be negative: ${globalDiscount}`)
    }

    const grossSum = round2(rawLines.reduce((sum, l) => sum + l.lineGross, 0))
    if (globalDiscount > grossSum) {
        throw new IssuanceError(
            "DISCOUNT_EXCEEDS_ITEMS",
            `Discount (${globalDiscount}) exceeds the gross sum of item lines (${grossSum}).`
        )
    }

    const processedLines: ComputedEcfLine[] = []
    let allocatedDiscount = 0

    for (let i = 0; i < rawLines.length; i++) {
        const l = rawLines[i]
        let lineDiscount = 0
        if (globalDiscount > 0) {
            if (i === rawLines.length - 1) {
                lineDiscount = round2(globalDiscount - allocatedDiscount)
            } else {
                lineDiscount = grossSum > 0 ? round2((globalDiscount * l.lineGross) / grossSum) : 0
                allocatedDiscount = round2(allocatedDiscount + lineDiscount)
            }
        }

        if (lineDiscount < 0 || lineDiscount > l.lineGross) {
            throw new IssuanceError(
                "DISCOUNT_ALLOCATION_INVALID",
                `Line item ${i + 1} allocated discount (${lineDiscount}) is invalid for line gross (${l.lineGross}).`
            )
        }

        const lineAmount = round2(l.quantity * l.unitPrice - lineDiscount)
        processedLines.push({
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: lineDiscount,
            lineAmount,
            taxable: l.taxable,
            isService: l.isService,
            unitMeasure: l.unitMeasure,
        })
    }

    // Shipping is ALWAYS appended as one exempt service line named "Envío"
    const shippingVal = round2(Number(options?.shipping || 0))
    if (shippingVal < 0) {
        throw new IssuanceError("INVALID_SHIPPING", `Shipping cost cannot be negative: ${shippingVal}`)
    }
    if (shippingVal > 0) {
        processedLines.push({
            name: "Envío",
            quantity: 1,
            unitPrice: shippingVal,
            discount: 0,
            lineAmount: shippingVal,
            taxable: false,
            isService: true,
            unitMeasure: null,
        })
    }

    let taxableAmount = 0
    let exemptAmount = 0
    for (const l of processedLines) {
        if (l.taxable) {
            taxableAmount = round2(taxableAmount + l.lineAmount)
        } else {
            exemptAmount = round2(exemptAmount + l.lineAmount)
        }
    }

    // ITBIS is computed strictly on the discounted taxable base
    const itbisAmount = taxableAmount > 0 ? round2(taxableAmount * 0.18) : 0
    const totalAmount = round2(taxableAmount + exemptAmount + itbisAmount)

    return {
        taxableAmount,
        exemptAmount,
        itbisAmount,
        totalAmount,
        lines: processedLines,
    }
}

export interface TotalsAmountPair {
    total: number | string | null | undefined
    tax: number | string | null | undefined
}

/**
 * Checks whether client-submitted totals drift from server-computed totals by more than 0.01 tolerance.
 * Returns true if total or tax differ by more than tolerance.
 */
export function totalsDrift(
    client: TotalsAmountPair,
    server: TotalsAmountPair,
    tolerance: number = 0.01
): boolean {
    const diffTotal = Math.abs(Number(client.total || 0) - Number(server.total || 0))
    const diffTax = Math.abs(Number(client.tax || 0) - Number(server.tax || 0))
    return diffTotal > tolerance || diffTax > tolerance
}
