/** DGII stamp of a printed e-CF invoice (see actions/ecf-print-actions.ts). */
export type EcfPrintData =
    | { state: "none" }
    | { state: "pending"; encf: string }
    | { state: "rejected"; encf: string; message: string }
    | {
        state: "ready"
        encf: string
        securityCode: string
        signedAt: string | null
        qrDataUrl: string
        accepted: boolean
    }

/** Electronic invoices carry an e-NCF (E31, E32...) instead of a printed NCF (B01...). */
export function isElectronicNcf(ncf: string | null | undefined): boolean {
    return Boolean(ncf && /^E\d{12}$/.test(ncf))
}

export function ecfDocumentTitle(ncf: string | null | undefined): string | null {
    if (!ncf) return null
    if (ncf.startsWith("E31")) return "Factura de Crédito Fiscal Electrónica"
    if (ncf.startsWith("E32")) return "Factura de Consumo Electrónica"
    if (ncf.startsWith("E34")) return "Nota de Crédito Electrónica"
    return null
}
