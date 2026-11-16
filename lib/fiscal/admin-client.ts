// SERVER ONLY. Builds an InsForge client using the server-side admin key (INSFORGE_ADMIN_KEY).
// Must never be imported from client components.

import { createClient } from "@insforge/sdk"

export function createFiscalAdminClient() {
    const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL
    const adminKey = process.env.INSFORGE_ADMIN_KEY
    if (!baseUrl || !adminKey) {
        throw new Error("Fiscal admin client not configured: NEXT_PUBLIC_INSFORGE_URL or INSFORGE_ADMIN_KEY is missing.")
    }
    return createClient({ baseUrl, anonKey: adminKey, isServerMode: true })
}
