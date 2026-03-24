import { createServerClient } from "@/lib/insforge/client"
import { CreateCreditNoteForm } from "@/components/modules/credit-notes/create-credit-note-form"
import type { InvoiceItem } from "@/types"

export default async function CreateCreditNotePage() {
    const insforge = createServerClient()

    const { data: recentInvoices } = await insforge.database
        .from('Invoice')
        .select(`
            *,
            items:InvoiceItem(*)
        `)
        .order('createdAt', { ascending: false })
        .limit(50)

    const serializedInvoices = (recentInvoices || []).map(inv => ({
        id: inv.id,
        sequenceNumber: inv.sequenceNumber,
        clientName: inv.clientName,
        total: Number(inv.total),
        createdAt: inv.createdAt,
        items: (inv.items || []).map((item: InvoiceItem) => ({
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
