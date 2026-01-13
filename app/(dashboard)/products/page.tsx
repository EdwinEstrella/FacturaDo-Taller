import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { getProducts } from "@/actions/product-actions"
import { getCurrentUser } from "@/actions/auth-actions"
import { formatCurrency } from "@/lib/utils"
import { ProductDialog } from "@/components/modules/products/product-dialog"
import { DeleteProductWrapper } from "@/components/modules/products/delete-product-wrapper"
import { Badge } from "@/components/ui/badge"
import type { Product } from "@prisma/client"

interface SerializedProduct extends Omit<Product, 'price' | 'cost'> {
    price: number
    cost: number
}

export default async function ProductsPage() {
    const user = await getCurrentUser()
    const products = await getProducts()

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
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Precio</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {serializedProducts.map((product) => (
                            <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{product.category}</Badge>
                                </TableCell>
                                <TableCell>{product.sku || "-"}</TableCell>
                                <TableCell>{formatCurrency(product.price)}</TableCell>
                                <TableCell>
                                    {product.isService ? (
                                        <span className="text-muted-foreground italic">Servicio</span>
                                    ) : (
                                        <span className={product.stock <= product.minStock ? "text-red-500 font-bold" : ""}>
                                            {product.stock}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right flex justify-end gap-2">
                                    {canManageProducts && (
                                        <>
                                            <ProductDialog product={product} />
                                            <DeleteProductWrapper productId={product.id} productName={product.name} />
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {serializedProducts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24">No hay productos registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
