"use server"

import { requireAuth } from "@/actions/auth-actions"
import { createServerClient } from "@/lib/insforge/client"

const INSTALLATION_PRODUCT_NAME = "Instalación"

/**
 * Returns the id of the service product used to bill installation charges from the POS,
 * creating it the first time. Returns null when it cannot be read or created.
 */
export async function ensureInstallationProduct(): Promise<string | null> {
    await requireAuth()
    const insforge = createServerClient()

    const { data: existing, error: readError } = await insforge.database
        .from("Product")
        .select("id")
        .eq("name", INSTALLATION_PRODUCT_NAME)
        .eq("isService", true)
        .limit(1)
    if (readError) {
        console.error("[ensureInstallationProduct] read failed:", readError)
        return null
    }
    if (existing && existing.length > 0) return existing[0].id

    const { data: created, error: createError } = await insforge.database
        .from("Product")
        .insert([{
            name: INSTALLATION_PRODUCT_NAME,
            description: "Cargo de instalación agregado desde el Punto de Venta",
            price: "0",
            cost: "0",
            category: "SERVICIO",
            isService: true,
        }])
        .select("id")
    if (createError || !created?.[0]) {
        console.error("[ensureInstallationProduct] create failed:", createError)
        return null
    }
    return created[0].id
}
