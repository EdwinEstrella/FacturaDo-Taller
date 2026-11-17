import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/actions/auth-actions"
import { getClients } from "@/actions/client-actions"
import { getProducts } from "@/actions/product-actions"
import { getInvoiceFiscalMode } from "@/actions/invoice-actions"
import { getCompanySettings } from "@/actions/settings-actions"
import { canAccess } from "@/lib/navigation"
import { PosTerminal } from "@/components/modules/pos/pos-terminal"
import type { SerializedProduct } from "@/components/modules/pos/pos-types"

export default async function PosPage() {
    const user = await getCurrentUser()

    if (!user || !canAccess(user.role, "/pos")) {
        redirect("/")
    }

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
        <div className="flex-1 space-y-3 h-[calc(100vh-6.5rem)] flex flex-col">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Punto de Venta</h2>
                    <p className="text-xs text-slate-500">Terminal de ventas rápidas y facturación.</p>
                </div>
            </div>

            <Suspense fallback={null}>
                <PosTerminal
                    initialClients={clients}
                    initialProducts={serializedProducts}
                    ecfEnabled={fiscalMode.ecfEnabled}
                    settings={settings}
                />
            </Suspense>
        </div>
    )
}
