import { prisma } from "@/lib/prisma"
import { CreateCreditNoteForm } from "@/components/modules/credit-notes/create-credit-note-form"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvoiceWithItems = any

export default async function CreateCreditNotePage() {
    // Look up recent invoices. Ideally filter by those that handle stock?
    const recentInvoices = await prisma.invoice.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
            items: true
        }
    })

    // Transform for client component to avoid Decimal issues
    const serializedInvoices = recentInvoices.map(inv => ({
        id: inv.id,
        sequenceNumber: inv.sequenceNumber,
        clientName: inv.clientName || inv.clientName, // Fallback? Both are same field
        total: Number(inv.total),
        createdAt: inv.createdAt,
        items: inv.items.map(item => ({
            id: item.id,
            productId: item.productId || "",
            productName: item.productName,
            quantity: item.quantity,
            price: Number(item.price)
        }))
    }))

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Nueva Nota de Crédito</h2>
            </div>

            <CreateCreditNoteForm invoices={serializedInvoices} />
        </div>
    )
}
