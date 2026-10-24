import { getProducts } from "@/actions/product-actions"
import { getCurrentUser } from "@/actions/auth-actions"
import { ProductDialog } from "@/components/modules/products/product-dialog"
import { ProductList } from "@/components/modules/products/product-list"
import { PageHeader } from "@/components/modules/shared/list-page"
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
        <div className="flex-1 space-y-6">
            <PageHeader
                title="Productos y Servicios"
                description="Catálogo con precios y existencia."
                actions={canManageProducts ? <ProductDialog /> : undefined}
            />
            <ProductList products={serializedProducts} canManageProducts={canManageProducts} />
        </div>
    )
}
