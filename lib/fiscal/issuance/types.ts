// DB-independent snapshots for electronic invoicing issuance (E31, E32, E34)

export interface IssuerSnapshot {
    rnc: string
    legalName: string
    tradeName?: string | null
    address: string
    municipality?: string | null
    province?: string | null
    economicActivity?: string | null
    branch?: string | null
    email?: string | null
    phone?: string | null
    website?: string | null
}

export interface BuyerSnapshot {
    rnc?: string | null
    name?: string | null
    address?: string | null
    phone?: string | null
    email?: string | null
}

export interface InvoiceLineSnapshot {
    name: string
    quantity: number
    unitPrice: number
    taxable: boolean
    isService: boolean
    unitMeasure?: string | null
}

export interface InvoiceTotalsSnapshot {
    subtotal?: number
    taxableAmount?: number
    exemptAmount?: number
    itbis?: number
    total?: number
}

export const PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "CREDIT"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export function isPaymentMethod(value: unknown): value is PaymentMethod {
    return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value)
}

export interface InvoicePaymentSnapshot {
    method: PaymentMethod
    dueDate?: Date | string | null
}

export interface InvoiceSnapshot {
    ecfType: "E31" | "E32"
    encf: string
    sequenceExpiresOn?: string | null // YYYY-MM-DD
    issuedAt: Date | string
    buyer?: BuyerSnapshot | null
    lines: InvoiceLineSnapshot[]
    shipping?: number | null
    discount?: number | null
    payment: InvoicePaymentSnapshot
    totals?: InvoiceTotalsSnapshot | null
}

export type InvoiceDataSnapshot = Omit<InvoiceSnapshot, "encf" | "sequenceExpiresOn">

export interface StoredInvoiceEcfSnapshot {
    issuer: IssuerSnapshot
    invoice: InvoiceDataSnapshot
}

export interface CreditNoteOriginalReference {
    encf: string
    issuedAt: Date | string
}

export interface CreditNoteReason {
    /** DGII modification code: 1=Anula, 2=Corrige texto, 3=Corrige montos, 4=Reemplazo contingencia, 5=Referencia contingencia */
    code: number
    text?: string | null
}

export interface CreditNoteSnapshot {
    ecfType?: "E34"
    encf: string
    sequenceExpiresOn?: string | null // YYYY-MM-DD
    issuedAt: Date | string
    original: CreditNoteOriginalReference
    reason: CreditNoteReason
    buyer?: BuyerSnapshot | null
    lines: InvoiceLineSnapshot[]
    totals?: InvoiceTotalsSnapshot | null
}

export interface ComputedEcfLine {
    name: string
    quantity: number
    unitPrice: number
    discount: number
    lineAmount: number
    taxable: boolean
    isService: boolean
    unitMeasure?: string | null
}

export interface ComputedEcfTotals {
    taxableAmount: number
    exemptAmount: number
    itbisAmount: number
    totalAmount: number
    lines: ComputedEcfLine[]
}

export interface BuildEcfResult {
    xml: string
    fiscalTotals: ComputedEcfTotals
}
