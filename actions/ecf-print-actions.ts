"use server"

import QRCode from "qrcode"
import { DOMParser } from "@xmldom/xmldom"
import { requireAuth } from "@/actions/auth-actions"
import { createFiscalAdminClient } from "@/lib/fiscal/admin-client"
import {
    buildPrintedQrUrl,
    dgiiEnvironmentSegment,
    parseSignedEcf,
    resolveSecurityCode,
} from "@/lib/fiscal/printed/representation"
import type { EcfPrintData } from "@/lib/fiscal/printed/ecf-print-data"

const SIGNED_EVENT_REASON = "submitted_to_dgii"

/**
 * Data the printed invoice needs for its DGII stamp (e-NCF, security code, signature date, QR).
 * The e-CF is signed by the fiscal worker a few seconds after the sale, so callers poll while
 * the state is "pending".
 */
export async function getInvoiceEcfPrint(invoiceId: string): Promise<EcfPrintData> {
    await requireAuth()
    const db = createFiscalAdminClient().database

    const { data: doc, error } = await db
        .from("EcfDocument")
        .select("id, encf, status, dgiiSecurityCode, lastError")
        .eq("invoiceId", invoiceId)
        .maybeSingle()
    if (error) throw new Error(`EcfDocument lookup failed: ${error.message}`)
    if (!doc) return { state: "none" }

    if (doc.status === "rejected" || doc.status === "terminal_error") {
        return { state: "rejected", encf: doc.encf, message: doc.lastError || "La DGII rechazó el comprobante." }
    }

    const { data: events } = await db
        .from("EcfDocumentEvent")
        .select("metadata")
        .eq("ecfDocumentId", doc.id)
        .eq("reason", SIGNED_EVENT_REASON)
        .order("createdAt", { ascending: false })
        .limit(1)
    const metadata = events?.[0]?.metadata as { signedXml?: string; environment?: string } | undefined
    if (!metadata?.signedXml) return { state: "pending", encf: doc.encf }

    // Server side: the browser DOMParser is not available, so pass the xmldom one.
    const model = parseSignedEcf(metadata.signedXml, new DOMParser() as unknown as Parameters<typeof parseSignedEcf>[1])
    const securityCode = resolveSecurityCode(model, doc.dgiiSecurityCode)
    const environment = metadata.environment === "production" ? "production" : metadata.environment === "certification" ? "certification" : "test"
    const qrUrl = buildPrintedQrUrl(model, { environment: dgiiEnvironmentSegment(environment), securityCode })
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 0, width: 240, errorCorrectionLevel: "M" })

    return {
        state: "ready",
        encf: doc.encf,
        securityCode,
        signedAt: model.fechaHoraFirma || null,
        qrDataUrl,
        accepted: doc.status === "accepted",
    }
}
