import { getClients } from "@/actions/client-actions"
import { getProducts } from "@/actions/product-actions"
import { InvoiceForm } from "@/components/modules/invoices/invoice-form"

export default async function CreateInvoicePage() {
    const clients = await getClients()
    const products = await getProducts()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6 h-full flex flex-col">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Nueva Factura</h2>
            </div>
            <InvoiceForm initialClients={clients} initialProducts={products} />
        </div>
    )
}
