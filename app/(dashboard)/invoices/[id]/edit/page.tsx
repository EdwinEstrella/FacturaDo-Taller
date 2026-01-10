import { getInvoiceById } from "@/actions/invoice-actions"
import { getClients } from "@/actions/client-actions"
import { getProducts } from "@/actions/product-actions"
import { InvoiceForm } from "@/components/modules/invoices/invoice-form"
import { notFound } from "next/navigation"
import type { Product } from "@prisma/client"

interface SerializedProduct extends Omit<Product, 'price'> {
    price: number
}

interface EditInvoicePageProps {
    params: {
        id: string
    }
}

import { getCurrentUser } from "@/actions/auth-actions"
import { redirect } from "next/navigation"

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") {
        redirect("/invoices")
    }

    const invoice = await getInvoiceById(params.id)
    const clients = await getClients()
    const products = await getProducts()

    if (!invoice) {
        notFound()
    }

    // Serialize Decimal to number for client component
    const serializedProducts: SerializedProduct[] = products.map(product => ({
        ...product,
        price: Number(product.price)
    }))

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Editar Factura #{invoice.sequenceNumber}</h2>
            </div>
            <InvoiceForm
                initialProducts={serializedProducts}
                initialClients={clients}
                initialData={invoice}
            />
        </div>
    )
}
