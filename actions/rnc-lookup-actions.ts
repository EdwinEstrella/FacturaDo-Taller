"use server"

import { getCurrentUser } from "@/actions/auth-actions"
import { fetchDgiiTaxpayer, RncNotFoundError, type RncLookupResult } from "@/lib/fiscal/rnc-lookup"

export type RncLookupResponse =
    | { success: true; data: RncLookupResult }
    | { success: false; error: string }

/**
 * Looks up a taxpayer by RNC (9 digits) or cédula (11 digits) on the public DGII consultation page.
 */
export async function lookupRnc(rawRnc: string): Promise<RncLookupResponse> {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Sesión no válida." }

    const rnc = String(rawRnc || "").replace(/\D/g, "")
    if (rnc.length !== 9 && rnc.length !== 11) {
        return { success: false, error: "El RNC debe tener 9 dígitos o la cédula 11 dígitos." }
    }

    try {
        return { success: true, data: await fetchDgiiTaxpayer(rnc) }
    } catch (error) {
        if (error instanceof RncNotFoundError) {
            return { success: false, error: "No se encontró ese RNC/cédula en la DGII." }
        }
        console.error("[lookupRnc] DGII lookup failed:", error)
        return { success: false, error: "No se pudo consultar la DGII. Verifique la conexión e intente de nuevo." }
    }
}
