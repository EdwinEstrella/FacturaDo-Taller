import { getSuppliers } from "@/actions/purchase-actions"
import { getProducts } from "@/actions/product-actions"
import PurchaseForm from "@/components/modules/liquidations/purchase-form"

export default async function LiquidationsPage() {
    const suppliers = await getSuppliers()
    const products = await getProducts()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight print:hidden">Compras de Mercancía</h2>
            <PurchaseForm suppliers={suppliers} products={products} />
        </div>
    )
}
