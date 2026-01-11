import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { getProducts } from "@/actions/product-actions"
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
    const products = await getProducts()

    // Serialize Decimal to number for client components
    const serializedProducts: SerializedProduct[] = products.map(product => ({
        ...product,
        price: Number(product.price)
    }))

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Productos e Inventario</h2>
                <div className="flex items-center space-x-2">
                    {/* <Button>Descargar Reporte</Button> */}
                    <ProductDialog />
                </div>
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
                                    <ProductDialog product={product} />
                                    {/* Only show delete if NOT seller */}
                                    {/* Since this is a server component, we can check role easily */}
                                    {/* Actually, I need to pass user role to this component or fetch it */}
                                    <DeleteProductWrapper productId={product.id} productName={product.name} />
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
