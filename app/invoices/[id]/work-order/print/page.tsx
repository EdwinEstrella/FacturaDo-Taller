import { notFound } from "next/navigation"
import Script from "next/script"
import { createServerClient } from "@/lib/insforge/client"
import { WorkOrderTemplate } from "@/components/modules/orders/work-order-template"

export default async function PrintWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const insforge = createServerClient()

    // Fetch Invoice AND WorkOrder. id here is INVOICE ID based on route /invoices/[id]/...
    const { data: invoice } = await insforge.database
        .from('Invoice')
        .select(`
            *,
            client:Client(*),
            items:InvoiceItem(*),
            workOrder:WorkOrder(*)
        `)
        .eq('id', id)
        .single()

    if (!invoice || !invoice.workOrder) return notFound()

    // Transform the data to match the expected interface
    const typedInvoice = {
        ...invoice,
        clientName: invoice.client?.name || invoice.clientName,
        sequenceNumber: invoice.sequenceNumber,
        workOrder: invoice.workOrder,
        items: invoice.items || [],
        client: invoice.client
    }

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center print:bg-white print:items-start print:justify-start">
            <WorkOrderTemplate invoice={typedInvoice} />
            <Script id="print-script" strategy="afterInteractive">
                {`window.print();`}
            </Script>
        </div>
    )
}
