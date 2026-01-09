import { getInvoiceById } from "@/actions/invoice-actions"
import { getClients } from "@/actions/client-actions"
import { getProducts } from "@/actions/product-actions"
import { InvoiceForm } from "@/components/modules/invoices/invoice-form"
import { notFound } from "next/navigation"

interface EditInvoicePageProps {
    params: {
        id: string
    }
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
    const invoice = await getInvoiceById(params.id)
    const clients = await getClients()
    const products = await getProducts()

    if (!invoice) {
        notFound()
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Editar Factura #{invoice.sequenceNumber}</h2>
            </div>
            <InvoiceForm
                initialProducts={products}
                initialClients={clients}
                initialData={invoice}
            />
        </div>
    )
}
