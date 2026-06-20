type InvoiceLine = {
    price: number | string
    quantity: number | string
}

type InvoiceLike = {
    items?: InvoiceLine[] | null
    tax?: number | string | null
    shippingCost?: number | string | null
    total?: number | string | null
    discount?: number | string | null
}

export function calculateInvoiceSubtotal(items: InvoiceLine[] = []) {
    return items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
}

export function calculateDerivedInvoiceDiscount(invoice: InvoiceLike) {
    if (invoice.discount !== undefined && invoice.discount !== null) {
        return Number(invoice.discount || 0)
    }

    const subtotal = calculateInvoiceSubtotal(invoice.items || [])
    const tax = Number(invoice.tax || 0)
    const shipping = Number(invoice.shippingCost || 0)
    const total = Number(invoice.total ?? subtotal + tax + shipping)
    const derivedDiscount = subtotal + tax + shipping - total

    return derivedDiscount > 0 ? derivedDiscount : 0
}
