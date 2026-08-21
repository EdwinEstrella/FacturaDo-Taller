import { getProducts } from "@/actions/product-actions"
import { getCurrentUser } from "@/actions/auth-actions"
import { ProductDialog } from "@/components/modules/products/product-dialog"
import { ProductList } from "@/components/modules/products/product-list"
import type { Product } from "@/types"

interface SerializedProduct extends Omit<Product, 'price' | 'cost'> {
    price: number
    cost: number
}

export default async function ProductsPage() {
    const [user, products] = await Promise.all([
        getCurrentUser(),
        getProducts()
    ])

    const canManageProducts = user?.role === "ADMIN" || user?.role === "MANAGER"

    // Serialize Decimal to number for client components
    const serializedProducts: SerializedProduct[] = products.map(product => ({
        ...product,
        price: Number(product.price)
    }))

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Productos e Inventario</h2>
                {canManageProducts && (
                    <div className="flex items-center space-x-2">
                        <ProductDialog />
                    </div>
                )}
            </div>
            <ProductList products={serializedProducts} canManageProducts={canManageProducts} />
        </div>
    )
}
