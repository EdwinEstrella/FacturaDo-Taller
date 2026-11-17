import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/actions/auth-actions"
import { getClients } from "@/actions/client-actions"
import { getProducts } from "@/actions/product-actions"
import { getInvoiceFiscalMode } from "@/actions/invoice-actions"
import { getCompanySettings } from "@/actions/settings-actions"
import { ensureInstallationProduct } from "@/actions/pos-actions"
import { canAccess } from "@/lib/navigation"
import { PosTerminal } from "@/components/modules/pos/pos-terminal"
import type { SerializedProduct } from "@/components/modules/pos/pos-types"

export default async function PosPage() {
    const user = await getCurrentUser()

    if (!user || !canAccess(user.role, "/pos")) {
        redirect("/")
    }

    // Created before loading products so the installation service is part of the catalog map.
    const installationProductId = await ensureInstallationProduct()

    const [[clients, products], fiscalMode, settings] = await Promise.all([
        Promise.all([
            getClients(),
            getProducts(),
        ]),
        getInvoiceFiscalMode(),
        getCompanySettings(),
    ])

    // Serialize Decimal to number for client component
    const serializedProducts: SerializedProduct[] = products.map((product) => ({
        ...product,
        price: Number(product.price),
        cost: Number(product.cost || 0),
    }))

    return (
        <div className="flex-1 h-[calc(100vh-5.25rem)] flex flex-col">
            <Suspense fallback={null}>
                <PosTerminal
                    initialClients={clients}
                    initialProducts={serializedProducts}
                    ecfEnabled={fiscalMode.ecfEnabled}
                    installationProductId={installationProductId}
                    settings={settings}
                />
            </Suspense>
        </div>
    )
}
