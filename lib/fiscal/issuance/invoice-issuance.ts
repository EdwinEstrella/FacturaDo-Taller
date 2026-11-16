// Server-only module: do not import from client components
// Server-side module for electronic invoice issuance (ECF-I2).
// Handles fiscal issuance context, issuer loading, snapshot building, and atomic enqueuing.

import { createServerClient } from "@/lib/insforge/client"
import { createFiscalAdminClient } from "../admin-client"
import { buyerFiscalId, resolveEcfType } from "./buyer"
import { IssuanceError, mapIssuanceErrorToSpanish } from "./errors"
import { round2, round4 } from "./totals"
import type {
    BuyerSnapshot,
    InvoiceDataSnapshot,
    InvoiceLineSnapshot,
    InvoiceTotalsSnapshot,
    IssuerSnapshot,
    PaymentMethod,
    StoredInvoiceEcfSnapshot,
} from "./types"

export const CREDIT_DUE_DAYS = 30

export { buyerFiscalId, resolveEcfType, mapIssuanceErrorToSpanish }

export interface BuildInvoiceSnapshotInputParams {
    items: Array<{
        name: string
        quantity: number
        unitPrice: number
        isService: boolean
        unitMeasure?: string | null
    }>
    client?: {
        name?: string | null
        rnc?: string | null
        cedula?: string | null
        address?: string | null
        phone?: string | null
        email?: string | null
    } | null
    payment: {
        method: PaymentMethod
        dueDate?: Date | string | null
    }
    shipping: number
    discount: number
    issuedAt: Date
    totals?: InvoiceTotalsSnapshot | null
}

export interface InvoiceSnapshotInput {
    ecfType: "E31" | "E32"
    invoice: InvoiceDataSnapshot
}

/**
 * Pure function: builds the snapshot input for an invoice from cart items, client, and parameters.
 * - Items already carry isService determined by caller; no aliases or category sniffing.
 * - Buyer fiscal identifier uses buyerFiscalId (invalid identifier is never sent as buyer RNC, returns null).
 * - For CREDIT payments, dueDate defaults to issuedAt + CREDIT_DUE_DAYS (30 days) if not explicitly set.
 * - Shipping and discount are carried over and normalized.
 */
export function buildInvoiceSnapshotInput(params: BuildInvoiceSnapshotInputParams): InvoiceSnapshotInput {
    const rawItems = Array.isArray(params.items) ? params.items : []
    const lines: InvoiceLineSnapshot[] = rawItems.map((item) => {
        const isService = Boolean(item.isService)
        const name = (item.name || "").trim()
        const quantity = round2(Number(item.quantity || 0))
        const unitPrice = round4(Number(item.unitPrice || 0))

        return {
            name,
            quantity,
            unitPrice,
            taxable: !isService,
            isService,
            unitMeasure: item.unitMeasure?.trim() || null,
        }
    })

    const ecfType = resolveEcfType(params.client)

    let buyer: BuyerSnapshot | null = null
    if (params.client) {
        const validFiscalId = buyerFiscalId(params.client)
        buyer = {
            rnc: validFiscalId,
            name: params.client.name?.trim() || null,
            address: params.client.address?.trim() || null,
            phone: params.client.phone?.trim() || null,
            email: params.client.email?.trim() || null,
        }
    }

    const shipping = round2(Number(params.shipping ?? 0))
    const discount = round2(Number(params.discount ?? 0))
    const issuedIso = params.issuedAt.toISOString()

    const method = params.payment.method
    let dueDate: string | null = null
    if (method === "CREDIT") {
        if (params.payment.dueDate) {
            dueDate = typeof params.payment.dueDate === "string"
                ? params.payment.dueDate
                : params.payment.dueDate.toISOString()
        } else {
            const due = new Date(params.issuedAt.getTime() + CREDIT_DUE_DAYS * 86_400_000)
            dueDate = due.toISOString()
        }
    }

    const invoice: InvoiceDataSnapshot = {
        ecfType,
        issuedAt: issuedIso,
        buyer,
        lines,
        shipping,
        discount,
        payment: {
            method,
            dueDate,
        },
        totals: params.totals || null,
    }

    return {
        ecfType,
        invoice,
    }
}

/**
 * Asserts that the issuer snapshot has all required DGII fields.
 * Throws IssuanceError("ISSUER_INCOMPLETE") listing the missing fields.
 */
export function assertIssuerComplete(issuer: Partial<IssuerSnapshot> | null | undefined): asserts issuer is IssuerSnapshot {
    const missing: string[] = []
    const rncDigits = (issuer?.rnc || "").replace(/\D/g, "")
    if (!rncDigits || (rncDigits.length !== 9 && rncDigits.length !== 11)) {
        missing.push("RNC (9 u 11 dígitos)")
    }
    if (!issuer?.legalName?.trim()) {
        missing.push("Razón social")
    }
    if (!issuer?.address?.trim()) {
        missing.push("Dirección")
    }

    if (missing.length > 0) {
        throw new IssuanceError(
            "ISSUER_INCOMPLETE",
            `Datos del emisor incompletos en la configuración fiscal: faltan [${missing.join(", ")}].`
        )
    }
}

/**
 * Loads fiscal mode from FiscalConfig.
 * Throws on database read errors (never silently defaults to ecfEnabled: false).
 */
export async function loadFiscalMode(): Promise<{ ecfEnabled: boolean }> {
    const insforge = createServerClient()
    const configRes = await insforge.database
        .from("FiscalConfig")
        .select("ecfEnabled")
        .eq("id", 1)
        .limit(1)

    if (configRes.error) {
        throw new Error(`Failed to load FiscalConfig: ${configRes.error.message}`)
    }

    return {
        ecfEnabled: Boolean(configRes.data?.[0]?.ecfEnabled),
    }
}

/**
 * Loads issuer snapshot from FiscalConfig with fallback to Setting table.
 * Uses only real Setting keys: COMPANY_NAME, COMPANY_RNC, COMPANY_ADDRESS.
 * Never fabricates issuer data.
 * Throws on database read errors or when required issuer fields are missing.
 */
export async function loadIssuer(): Promise<IssuerSnapshot> {
    const insforge = createServerClient()

    const [configRes, settingsRes] = await Promise.all([
        insforge.database.from("FiscalConfig").select("*").eq("id", 1).limit(1),
        insforge.database.from("Setting").select("key, value"),
    ])

    if (configRes.error) {
        throw new Error(`Failed to load FiscalConfig: ${configRes.error.message}`)
    }
    if (settingsRes.error) {
        throw new Error(`Failed to load Setting: ${settingsRes.error.message}`)
    }

    const config = configRes.data?.[0] as Record<string, unknown> | undefined
    const settingsMap = new Map<string, string>()
    for (const row of settingsRes.data || []) {
        if (row.key && row.value !== undefined && row.value !== null) {
            settingsMap.set(String(row.key), String(row.value))
        }
    }

    const rawRnc = String(config?.rnc || settingsMap.get("COMPANY_RNC") || "").trim()
    const rnc = rawRnc.replace(/\D/g, "")
    const legalName = String(config?.legalName || settingsMap.get("COMPANY_NAME") || "").trim()
    const tradeName = String(config?.tradeName || settingsMap.get("COMPANY_NAME") || legalName).trim()
    const address = String(config?.address || settingsMap.get("COMPANY_ADDRESS") || "").trim()

    const candidate: Partial<IssuerSnapshot> = {
        rnc,
        legalName,
        tradeName: tradeName || null,
        address,
        municipality: config?.municipality ? String(config.municipality).trim() : null,
        province: config?.province ? String(config.province).trim() : null,
        economicActivity: config?.economicActivity ? String(config.economicActivity).trim() : null,
        branch: config?.issuerBranch ? String(config.issuerBranch).trim() : null,
        email: config?.issuerEmail ? String(config.issuerEmail).trim() : null,
        phone: settingsMap.get("COMPANY_PHONE")?.trim() || null,
    }

    assertIssuerComplete(candidate)
    return candidate
}

export interface EnqueueInvoiceEcfResult {
    ecfDocumentId: string
    encf: string
    expiresOn: string
}

/**
 * Calls atomic RPC enqueue_invoice_ecf using the server-side admin client.
 * Takes the typed stored snapshot containing frozen { issuer, invoice }.
 * Throws IssuanceError(code) only without localized Spanish strings.
 */
export async function enqueueInvoiceEcf(
    invoiceId: string,
    ecfType: "E31" | "E32",
    snapshot: StoredInvoiceEcfSnapshot
): Promise<EnqueueInvoiceEcfResult> {
    const db = createFiscalAdminClient().database

    const { data, error } = await db.rpc("enqueue_invoice_ecf", {
        p_invoice_id: invoiceId,
        p_ecf_type: ecfType,
        p_snapshot: snapshot,
    })

    if (error) {
        const msg = String(error.message || error)
        for (const code of [
            "ECF_SEQUENCE_NOT_CONFIGURED",
            "ECF_SEQUENCE_EXPIRED",
            "ECF_SEQUENCE_EXHAUSTED",
            "ECF_DISABLED",
            "ECF_ALREADY_ISSUED",
            "INVALID_ECF_TYPE",
            "INVOICE_NOT_FOUND",
        ]) {
            if (msg.includes(code)) {
                throw new IssuanceError(code, code)
            }
        }
        throw new IssuanceError("ENQUEUE_FAILED", msg)
    }

    const parsed = typeof data === "string" ? JSON.parse(data) : data
    return parsed as EnqueueInvoiceEcfResult
}
