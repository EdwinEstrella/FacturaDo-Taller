import { Suspense } from "react"
import { getClients } from "@/actions/client-actions"
import { getProducts } from "@/actions/product-actions"
import { getQuoteById } from "@/actions/quote-actions"
import { InvoiceForm } from "@/components/modules/invoices/invoice-form"
import type { Product } from "@/types"

interface SerializedProduct extends Omit<Product, 'price' | 'cost'> {
    price: number
    cost: number
}

export default async function CreateInvoicePage({
    searchParams,
}: {
    searchParams: Promise<{ type?: string, sourceQuoteId?: string }>
}) {
    const [{ type, sourceQuoteId }, [clients, products]] = await Promise.all([
        searchParams,
        Promise.all([
            getClients(),
            getProducts()
        ])
    ])

    const isQuoteMode = type === "QUOTE"

    // If sourceQuoteId is present, load the quote to prefill the invoice form
    let sourceQuote = null
    if (sourceQuoteId && !isQuoteMode) {
        sourceQuote = await getQuoteById(sourceQuoteId)
        console.log("Source Quote ID:", sourceQuoteId)
        console.log("Source Quote:", sourceQuote ? "FOUND" : "NOT FOUND")
        if (sourceQuote) console.log("Source Quote Items:", sourceQuote.items)
    }

    // Serialize Decimal to number for client component
    const serializedProducts: SerializedProduct[] = products.map(product => ({
        ...product,
        price: Number(product.price)
    }))

    return (
        <div className="flex-1 space-y-4 p-8 pt-6 h-full flex flex-col">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">{isQuoteMode ? "Nueva Cotización" : (sourceQuote ? "Facturar Cotización" : "Nueva Factura")}</h2>
            </div>
            <Suspense fallback={null}>
                <InvoiceForm 
                    key={sourceQuote?.id || "new"}
                    initialClients={clients} 
                    initialProducts={serializedProducts} 
                    sourceQuote={sourceQuote} 
                />
            </Suspense>
        </div>
    )
}
