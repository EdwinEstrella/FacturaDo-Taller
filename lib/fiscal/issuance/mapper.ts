// Pure functions to map invoices and credit notes to unsigned DGII e-CF XML.
// Element order and formatting strictly follow accepted DGII certification submissions
// and lib/fiscal/certification/builder.ts.

import { escapeXml } from "../certification/builder"
import { IssuanceError } from "./errors"
import type {
    BuildEcfResult,
    BuyerSnapshot,
    ComputedEcfLine,
    ComputedEcfTotals,
    CreditNoteSnapshot,
    InvoiceLineSnapshot,
    InvoiceSnapshot,
    InvoiceTotalsSnapshot,
    IssuerSnapshot,
    PaymentMethod,
} from "./types"

const XML_DECLARATION = '<?xml version="1.0" encoding="utf-8"?>'

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

/**
 * Formats a Date or ISO date string into DGII date format: dd-MM-yyyy.
 * If given a YYYY-MM-DD string, extracts components directly without timezone shifting.
 * If given a Date, formats in Dominican Republic time zone (UTC-4, no DST).
 */
export function formatDgiiDate(dateOrStr: Date | string): string {
    if (typeof dateOrStr === "string") {
        const trimmed = dateOrStr.trim()
        const matchIso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
        if (matchIso) {
            return `${matchIso[3]}-${matchIso[2]}-${matchIso[1]}`
        }
        const matchDgii = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed)
        if (matchDgii) {
            return trimmed
        }
    }
    const d = typeof dateOrStr === "string" ? new Date(dateOrStr) : dateOrStr
    if (!Number.isFinite(d.getTime())) {
        throw new IssuanceError("INVALID_DATE", `Invalid date value: ${String(dateOrStr)}`)
    }
    const local = new Date(d.getTime() - 4 * 3600 * 1000)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${pad(local.getUTCDate())}-${pad(local.getUTCMonth() + 1)}-${local.getUTCFullYear()}`
}

/**
 * Calculates days elapsed between two dates (UTC calendar days).
 */
function calculateDaysElapsed(originalDate: Date | string, noteDate: Date | string): number {
    const origStr = formatDgiiDate(originalDate)
    const noteStr = formatDgiiDate(noteDate)
    const [origDay, origMonth, origYear] = origStr.split("-").map(Number)
    const [noteDay, noteMonth, noteYear] = noteStr.split("-").map(Number)
    const origUtc = Date.UTC(origYear, origMonth - 1, origDay)
    const noteUtc = Date.UTC(noteYear, noteMonth - 1, noteDay)
    return Math.round((noteUtc - origUtc) / 86_400_000)
}

/**
 * Maps payment method enum to DGII "Formas de pago" code using an exhaustive switch:
 * CASH -> 1 (Efectivo)
 * TRANSFER -> 2 (Cheque / Transferencia / Depósito)
 * CARD -> 3 (Tarjeta Débito / Crédito)
 * CREDIT -> 4 (Venta a crédito)
 */
export function mapPaymentMethodToDgiiCode(method: PaymentMethod): number {
    switch (method) {
        case "CASH":
            return 1
        case "TRANSFER":
            return 2
        case "CARD":
            return 3
        case "CREDIT":
            return 4
        default: {
            const exhaustiveCheck: never = method
            throw new IssuanceError("INVALID_PAYMENT_METHOD", `Unhandled payment method: ${String(exhaustiveCheck)}`)
        }
    }
}

/**
 * Formats unit price for DGII XML emission:
 * If price has sub-cent decimals (> 2 decimals), emit 4 decimals (Decimal(14,4) in DGII standard).
 * Otherwise emit standard 2 decimals.
 */
function formatUnitPrice(price: number): string {
    const hasSubCent = Math.abs(price * 100 - Math.round(price * 100)) > 1e-4
    return hasSubCent ? price.toFixed(4) : price.toFixed(2)
}

export interface ComputeEcfTotalsOptions {
    shipping?: number | null
    discount?: number | null
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

function validateIssuer(issuer: IssuerSnapshot): {
    rnc: string
    legalName: string
    tradeName?: string
    address: string
    municipality?: string
    province?: string
    economicActivity?: string
    branch?: string
    email?: string
    phone?: string
    website?: string
} {
    const rnc = (issuer.rnc || "").replace(/\D/g, "")
    if (!rnc || (rnc.length !== 9 && rnc.length !== 11)) {
        throw new IssuanceError("ISSUER_RNC_INVALID", `Issuer RNC must be 9 or 11 digits, got: ${issuer.rnc}`)
    }
    const legalName = (issuer.legalName || "").trim()
    if (!legalName) {
        throw new IssuanceError("ISSUER_LEGAL_NAME_REQUIRED", "Issuer legal name (RazonSocialEmisor) is required.")
    }
    const address = (issuer.address || "").trim()
    if (!address) {
        throw new IssuanceError("ISSUER_ADDRESS_REQUIRED", "Issuer address (DireccionEmisor) is required.")
    }

    return {
        rnc,
        legalName,
        tradeName: issuer.tradeName?.trim() || undefined,
        address,
        municipality: issuer.municipality?.trim() || undefined,
        province: issuer.province?.trim() || undefined,
        economicActivity: issuer.economicActivity?.trim() || undefined,
        branch: issuer.branch?.trim() || undefined,
        email: issuer.email?.trim() || undefined,
        phone: issuer.phone?.trim() || undefined,
        website: issuer.website?.trim() || undefined,
    }
}

function renderEmisor(issuer: ReturnType<typeof validateIssuer>, fechaEmision: string): string {
    const parts: string[] = []
    parts.push(`<RNCEmisor>${issuer.rnc}</RNCEmisor>`)
    parts.push(`<RazonSocialEmisor>${escapeXml(issuer.legalName)}</RazonSocialEmisor>`)
    if (issuer.tradeName) {
        parts.push(`<NombreComercial>${escapeXml(issuer.tradeName)}</NombreComercial>`)
    }
    if (issuer.branch) {
        parts.push(`<Sucursal>${escapeXml(issuer.branch)}</Sucursal>`)
    }
    parts.push(`<DireccionEmisor>${escapeXml(issuer.address)}</DireccionEmisor>`)
    if (issuer.municipality && /^\d{6}$/.test(issuer.municipality)) {
        parts.push(`<Municipio>${issuer.municipality}</Municipio>`)
    }
    if (issuer.province && /^\d{6}$/.test(issuer.province)) {
        parts.push(`<Provincia>${issuer.province}</Provincia>`)
    }
    if (issuer.phone) {
        parts.push(`<TablaTelefonoEmisor><TelefonoEmisor>${escapeXml(issuer.phone)}</TelefonoEmisor></TablaTelefonoEmisor>`)
    }
    if (issuer.email) {
        parts.push(`<CorreoEmisor>${escapeXml(issuer.email)}</CorreoEmisor>`)
    }
    if (issuer.website) {
        parts.push(`<WebSite>${escapeXml(issuer.website)}</WebSite>`)
    }
    if (issuer.economicActivity) {
        parts.push(`<ActividadEconomica>${escapeXml(issuer.economicActivity)}</ActividadEconomica>`)
    }
    parts.push(`<FechaEmision>${fechaEmision}</FechaEmision>`)
    return `<Emisor>${parts.join("")}</Emisor>`
}

function renderComprador(buyer?: BuyerSnapshot | null, isE31 = false): string {
    const rnc = buyer?.rnc?.replace(/\D/g, "") || ""
    const name = buyer?.name?.trim() || ""

    if (isE31) {
        if (!rnc || (rnc.length !== 9 && rnc.length !== 11)) {
            throw new IssuanceError(
                "BUYER_RNC_REQUIRED",
                `Crédito Fiscal (E31) requires a valid buyer RNC or Cédula (9 or 11 digits), got: ${buyer?.rnc || "(none)"}`
            )
        }
        if (!name) {
            throw new IssuanceError("BUYER_NAME_REQUIRED", "Crédito Fiscal (E31) requires a buyer name (RazonSocialComprador).")
        }
    }

    if (!rnc && !name) {
        return ""
    }

    const parts: string[] = []
    if (rnc) {
        parts.push(`<RNCComprador>${rnc}</RNCComprador>`)
    }
    if (name) {
        parts.push(`<RazonSocialComprador>${escapeXml(name)}</RazonSocialComprador>`)
    }
    if (buyer?.email?.trim()) {
        parts.push(`<CorreoComprador>${escapeXml(buyer.email.trim())}</CorreoComprador>`)
    }
    if (buyer?.address?.trim()) {
        parts.push(`<DireccionComprador>${escapeXml(buyer.address.trim())}</DireccionComprador>`)
    }

    return `<Comprador>${parts.join("")}</Comprador>`
}

function renderTotales(totals: ComputedEcfTotals): string {
    const parts: string[] = []
    if (totals.taxableAmount > 0) {
        parts.push(`<MontoGravadoTotal>${totals.taxableAmount.toFixed(2)}</MontoGravadoTotal>`)
        parts.push(`<MontoGravadoI1>${totals.taxableAmount.toFixed(2)}</MontoGravadoI1>`)
    }
    if (totals.exemptAmount > 0) {
        parts.push(`<MontoExento>${totals.exemptAmount.toFixed(2)}</MontoExento>`)
    }
    if (totals.taxableAmount > 0) {
        parts.push(`<ITBIS1>18</ITBIS1>`)
        parts.push(`<TotalITBIS>${totals.itbisAmount.toFixed(2)}</TotalITBIS>`)
        parts.push(`<TotalITBIS1>${totals.itbisAmount.toFixed(2)}</TotalITBIS1>`)
    }
    // Note: When taxableAmount === 0 (exempt-only document), TotalITBIS is omitted completely.
    // Verified against accepted certification rows (e.g. case 133339749E430000000011, 133339749E330000000001).
    parts.push(`<MontoTotal>${totals.totalAmount.toFixed(2)}</MontoTotal>`)
    return `<Totales>${parts.join("")}</Totales>`
}

function renderDetallesItems(lines: ComputedEcfLine[]): string {
    const itemsXml = lines.map((line, idx) => {
        const itemParts: string[] = []
        itemParts.push(`<NumeroLinea>${idx + 1}</NumeroLinea>`)
        // IndicadorFacturacion: 1 = Gravado al 18%, 4 = Exento
        itemParts.push(`<IndicadorFacturacion>${line.taxable ? 1 : 4}</IndicadorFacturacion>`)
        itemParts.push(`<NombreItem>${escapeXml(line.name.slice(0, 80))}</NombreItem>`)
        // IndicadorBienoServicio: 1 = Bien, 2 = Servicio
        itemParts.push(`<IndicadorBienoServicio>${line.isService ? 2 : 1}</IndicadorBienoServicio>`)
        itemParts.push(`<CantidadItem>${line.quantity.toFixed(2)}</CantidadItem>`)
        if (line.unitMeasure) {
            itemParts.push(`<UnidadMedida>${escapeXml(line.unitMeasure)}</UnidadMedida>`)
        }
        itemParts.push(`<PrecioUnitarioItem>${formatUnitPrice(line.unitPrice)}</PrecioUnitarioItem>`)
        if (line.discount > 0) {
            itemParts.push(`<DescuentoMonto>${line.discount.toFixed(2)}</DescuentoMonto>`)
        }
        itemParts.push(`<MontoItem>${line.lineAmount.toFixed(2)}</MontoItem>`)
        return `<Item>${itemParts.join("")}</Item>`
    }).join("")

    return `<DetallesItems>${itemsXml}</DetallesItems>`
}

/**
 * Asserts that stored document totals match computed fiscal totals within a 0.01 tolerance.
 * Guards against ITBIS on exempt-only documents and discrepancies in stored totals.
 */
function assertStoredTotalsMatch(
    fiscal: ComputedEcfTotals,
    stored?: InvoiceTotalsSnapshot | null
): void {
    if (!stored) return

    if (stored.itbis != null) {
        const storedItbis = round2(Number(stored.itbis))
        if (fiscal.taxableAmount === 0 && storedItbis > 0) {
            throw new IssuanceError("TOTALS_MISMATCH", `Stored ITBIS is ${storedItbis} but there are no taxable lines.`)
        }
        if (Math.abs(storedItbis - fiscal.itbisAmount) > 0.01) {
            throw new IssuanceError(
                "TOTALS_MISMATCH",
                `Stored ITBIS (${storedItbis}) differs from computed ITBIS (${fiscal.itbisAmount}) by more than 0.01.`
            )
        }
    }
    if (stored.total != null) {
        const storedTotal = round2(Number(stored.total))
        if (Math.abs(storedTotal - fiscal.totalAmount) > 0.01) {
            throw new IssuanceError(
                "TOTALS_MISMATCH",
                `Stored total (${storedTotal}) differs from balanced total (${fiscal.totalAmount}) by more than 0.01.`
            )
        }
    }
}

/**
 * Builds an unsigned e-CF XML for real invoices (E31 or E32).
 * Pure function: takes all parameters and `now` without I/O.
 * Returns XML and computed fiscal totals so the caller (task I2) can persist exact e-CF figures.
 */
export function buildInvoiceEcfXml(
    issuerInput: IssuerSnapshot,
    invoice: InvoiceSnapshot,
    now: Date
): BuildEcfResult {
    const issuer = validateIssuer(issuerInput)

    const ecfType = invoice.ecfType
    if (ecfType !== "E31" && ecfType !== "E32") {
        throw new IssuanceError("INVALID_ECF_TYPE", `Invoice ecfType must be E31 or E32, got: ${ecfType}`)
    }

    const encf = (invoice.encf || "").trim()
    const expectedPrefix = ecfType
    if (!new RegExp(`^${expectedPrefix}\\d{10}$`).test(encf)) {
        throw new IssuanceError("INVALID_ENCF", `Invoice eNCF must be 13 characters starting with ${expectedPrefix}, got: ${encf}`)
    }

    const numericType = Number(ecfType.slice(1)) // 31 or 32
    const fechaEmision = formatDgiiDate(invoice.issuedAt || now)

    // Sequence expiration date (FechaVencimientoSecuencia):
    // Emitted ONLY for E31 (DGII rules: E32 consumer sequences do not expire).
    let fechaVencimientoSecuencia: string | null = null
    if (numericType === 31) {
        if (!invoice.sequenceExpiresOn) {
            throw new IssuanceError("SEQUENCE_EXPIRY_REQUIRED", "Factura de Crédito Fiscal (E31) requires sequenceExpiresOn.")
        }
        fechaVencimientoSecuencia = formatDgiiDate(invoice.sequenceExpiresOn)
    }

    // Payment terms & method (explicit model)
    const isCredit = invoice.payment.method === "CREDIT"
    const tipoPago = isCredit ? 2 : 1
    const terminoPago = isCredit ? "A credito" : "Al contado"
    let fechaLimitePago = fechaEmision
    if (isCredit) {
        const dueDate = invoice.payment.dueDate
        if (!dueDate) {
            throw new IssuanceError("PAYMENT_DUE_DATE_REQUIRED", "Credit invoice requires a payment dueDate (FechaLimitePago).")
        }
        fechaLimitePago = formatDgiiDate(dueDate)
    }
    const formaPagoCode = mapPaymentMethodToDgiiCode(invoice.payment.method)

    // Compute fiscal totals and balanced lines
    const fiscalTotals = computeEcfTotals(invoice.lines, {
        shipping: invoice.shipping,
        discount: invoice.discount,
    })

    // Stored-totals guard: ONLY validated when no global discount is present (tolerance 0.01).
    // When a discount is present, the app historically computes ITBIS BEFORE the discount,
    // causing legitimate differences between the stored total and the fiscal e-CF total.
    // In that case, validation is skipped and fiscalTotals is returned so the caller can persist e-CF figures.
    const hasGlobalDiscount = invoice.discount != null && Number(invoice.discount) > 0
    if (!hasGlobalDiscount && invoice.totals) {
        assertStoredTotalsMatch(fiscalTotals, invoice.totals)
    }

    // 1. IdDoc
    // Canonical element order:
    // TipoeCF -> eNCF -> [FechaVencimientoSecuencia] -> IndicadorMontoGravado ->
    // TipoIngresos -> TipoPago -> FechaLimitePago -> TerminoPago -> TablaFormasPago
    const idDocParts: string[] = []
    idDocParts.push(`<TipoeCF>${numericType}</TipoeCF>`)
    idDocParts.push(`<eNCF>${encf}</eNCF>`)
    if (fechaVencimientoSecuencia) {
        idDocParts.push(`<FechaVencimientoSecuencia>${fechaVencimientoSecuencia}</FechaVencimientoSecuencia>`)
    }
    // IndicadorMontoGravado = 0 (line item amounts do not include ITBIS)
    idDocParts.push(`<IndicadorMontoGravado>0</IndicadorMontoGravado>`)
    // TipoIngresos = 01 (Ingresos por operaciones no financieros)
    idDocParts.push(`<TipoIngresos>01</TipoIngresos>`)
    idDocParts.push(`<TipoPago>${tipoPago}</TipoPago>`)
    idDocParts.push(`<FechaLimitePago>${fechaLimitePago}</FechaLimitePago>`)
    idDocParts.push(`<TerminoPago>${terminoPago}</TerminoPago>`)
    idDocParts.push(
        `<TablaFormasPago><FormaDePago><FormaPago>${formaPagoCode}</FormaPago><MontoPago>${fiscalTotals.totalAmount.toFixed(2)}</MontoPago></FormaDePago></TablaFormasPago>`
    )
    const idDocXml = `<IdDoc>${idDocParts.join("")}</IdDoc>`

    // 2. Emisor
    const emisorXml = renderEmisor(issuer, fechaEmision)

    // 3. Comprador
    const compradorXml = renderComprador(invoice.buyer, numericType === 31)

    // 4. Totales
    const totalesXml = renderTotales(fiscalTotals)

    // 5. Encabezado
    const encabezadoXml = `<Encabezado><Version>1.0</Version>${idDocXml}${emisorXml}${compradorXml}${totalesXml}</Encabezado>`

    // 6. DetallesItems
    const detallesItemsXml = renderDetallesItems(fiscalTotals.lines)

    return {
        xml: `${XML_DECLARATION}<ECF>${encabezadoXml}${detallesItemsXml}</ECF>`,
        fiscalTotals,
    }
}

/**
 * Builds an unsigned e-CF XML for credit notes (E34).
 * Pure function: takes all parameters and `now` without I/O.
 * Returns XML and computed fiscal totals so the caller (task I2) can persist exact e-CF figures.
 */
export function buildCreditNoteEcfXml(
    issuerInput: IssuerSnapshot,
    note: CreditNoteSnapshot,
    now: Date
): BuildEcfResult {
    const issuer = validateIssuer(issuerInput)

    const encf = (note.encf || "").trim()
    if (!/^E34\d{10}$/.test(encf)) {
        throw new IssuanceError("INVALID_ENCF", `Credit note eNCF must be 13 characters starting with E34, got: ${encf}`)
    }

    if (!note.original || !note.original.encf) {
        throw new IssuanceError("ORIGINAL_REFERENCE_REQUIRED", "Credit note (E34) requires an original reference e-NCF.")
    }
    const origEncf = note.original.encf.trim()
    if (!/^E(31|32|33|34|41|43|44|45|46|47)\d{10}$/.test(origEncf)) {
        throw new IssuanceError("INVALID_ORIGINAL_ENCF", `Original reference e-NCF is invalid: ${origEncf}`)
    }

    if (!note.reason || note.reason.code < 1 || note.reason.code > 5) {
        throw new IssuanceError("INVALID_REASON_CODE", `Credit note reason modification code must be between 1 and 5, got: ${note.reason?.code}`)
    }

    const fechaEmision = formatDgiiDate(note.issuedAt || now)
    const fechaOrig = formatDgiiDate(note.original.issuedAt)

    // IndicadorNotaCredito: 1 if > 30 days have elapsed since original invoice, else 0
    const daysElapsed = calculateDaysElapsed(note.original.issuedAt, note.issuedAt || now)
    const indicadorNotaCredito = daysElapsed > 30 ? 1 : 0

    // Compute fiscal totals
    const fiscalTotals = computeEcfTotals(note.lines, { shipping: 0, discount: 0 })

    if (note.totals) {
        assertStoredTotalsMatch(fiscalTotals, note.totals)
    }

    // 1. IdDoc for E34
    // Canonical element order: TipoeCF -> eNCF -> IndicadorNotaCredito -> IndicadorMontoGravado -> TipoIngresos -> TipoPago
    const idDocParts: string[] = []
    idDocParts.push(`<TipoeCF>34</TipoeCF>`)
    idDocParts.push(`<eNCF>${encf}</eNCF>`)
    idDocParts.push(`<IndicadorNotaCredito>${indicadorNotaCredito}</IndicadorNotaCredito>`)
    idDocParts.push(`<IndicadorMontoGravado>0</IndicadorMontoGravado>`)
    idDocParts.push(`<TipoIngresos>01</TipoIngresos>`)
    idDocParts.push(`<TipoPago>1</TipoPago>`)
    const idDocXml = `<IdDoc>${idDocParts.join("")}</IdDoc>`

    // 2. Emisor
    const emisorXml = renderEmisor(issuer, fechaEmision)

    // 3. Comprador
    const compradorXml = renderComprador(note.buyer, false)

    // 4. Totales
    const totalesXml = renderTotales(fiscalTotals)

    // 5. Encabezado
    const encabezadoXml = `<Encabezado><Version>1.0</Version>${idDocXml}${emisorXml}${compradorXml}${totalesXml}</Encabezado>`

    // 6. DetallesItems
    const detallesItemsXml = renderDetallesItems(fiscalTotals.lines)

    // 7. InformacionReferencia
    // Canonical order: NCFModificado -> FechaNCFModificado -> CodigoModificacion -> [RazonModificacion]
    const refParts: string[] = []
    refParts.push(`<NCFModificado>${origEncf}</NCFModificado>`)
    refParts.push(`<FechaNCFModificado>${fechaOrig}</FechaNCFModificado>`)
    refParts.push(`<CodigoModificacion>${note.reason.code}</CodigoModificacion>`)
    const reasonText = (note.reason.text || "").trim().slice(0, 90)
    if (reasonText) {
        refParts.push(`<RazonModificacion>${escapeXml(reasonText)}</RazonModificacion>`)
    }
    const infoRefXml = `<InformacionReferencia>${refParts.join("")}</InformacionReferencia>`

    return {
        xml: `${XML_DECLARATION}<ECF>${encabezadoXml}${detallesItemsXml}${infoRefXml}</ECF>`,
        fiscalTotals,
    }
}
