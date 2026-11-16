// Pure, dependency-free buyer and product classification utilities.
// Safe to import from client components, server actions, and background workers.

export interface FiscalClientCandidate {
    rnc?: string | null
    cedula?: string | null
}

export interface ProductCandidate {
    isService?: boolean | null
    category?: string | null
}

/**
 * Strips non-digits from client's RNC, then cédula.
 * Returns the first identifier that has exactly 9 or 11 digits, or null if neither matches.
 * An invalid identifier is never returned as a fiscal ID.
 */
export function buyerFiscalId(client?: FiscalClientCandidate | null): string | null {
    if (!client) return null

    const rncDigits = (client.rnc || "").replace(/\D/g, "")
    if (rncDigits.length === 9 || rncDigits.length === 11) {
        return rncDigits
    }

    const cedulaDigits = (client.cedula || "").replace(/\D/g, "")
    if (cedulaDigits.length === 9 || cedulaDigits.length === 11) {
        return cedulaDigits
    }

    return null
}

/**
 * Resolves whether an invoice should be issued as E31 (Crédito Fiscal) or E32 (Consumo).
 * Rules:
 * E31 when buyerFiscalId(client) returns a valid 9 or 11 digit identifier.
 * Otherwise E32.
 */
export function resolveEcfType(client?: FiscalClientCandidate | null): "E31" | "E32" {
    return buyerFiscalId(client) ? "E31" : "E32"
}

/**
 * Shared helper to determine if a product is a service (exempt from ITBIS in workshop context).
 * Used by form, server actions, and snapshot builder.
 */
export function isServiceProduct(product?: ProductCandidate | null): boolean {
    return Boolean(product?.isService || product?.category === "SERVICIO")
}
