import { Suspense } from "react"
import { getQuoteById } from "@/actions/quote-actions"
import { getClients } from "@/actions/client-actions"
import { getProducts } from "@/actions/product-actions"
import { InvoiceForm } from "@/components/modules/invoices/invoice-form"
import { notFound, redirect } from "next/navigation"
import type { Product } from "@/types"
import { getCurrentUser } from "@/actions/auth-actions"

interface SerializedProduct extends Omit<Product, 'price' | 'cost'> {
    price: number
    cost: number
}

interface EditQuotePageProps {
    params: Promise<{
        id: string
    }>
}

export default async function EditQuotePage({ params }: EditQuotePageProps) {
    const [{ id }, user] = await Promise.all([params, getCurrentUser()])
    
    // Only Admin can edit
    if (!user || user.role !== "ADMIN") {
        redirect("/quotes")
    }

    const [quote, clients, products] = await Promise.all([
        getQuoteById(id),
        getClients(),
        getProducts()
    ])

    if (!quote) {
        notFound()
    }

    // Serialize Decimal to number for client component
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serializedProducts: SerializedProduct[] = products.map((product: any) => ({
        ...product,
        price: Number(product.price),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        variants: product.variants?.map((v: any) => ({
            ...v,
            price: Number(v.price)
        }))
    }))

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Editar Cotización #{quote.sequenceNumber}</h2>
            </div>
            <Suspense fallback={null}>
                <InvoiceForm
                    initialProducts={serializedProducts}
                    initialClients={clients}
                    initialData={quote}
                    documentType="QUOTE"
                />
            </Suspense>
        </div>
    )
}
