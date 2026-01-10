import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { WorkOrderTemplate } from "@/components/modules/orders/work-order-template"
import type { Invoice } from "@/types"

interface InvoiceWithWorkOrder extends Invoice {
    workOrder: {
        id: string
        status: string
        productionNotes?: string | null
        createdAt: Date
        updatedAt: Date
    }
}

export default async function PrintWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    // Fetch Invoice AND WorkOrder. id here is INVOICE ID based on route /invoices/[id]/...
    const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
            client: true,
            items: true,
            workOrder: true
        }
    }) as InvoiceWithWorkOrder | null

    if (!invoice || !invoice.workOrder) return notFound()

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center print:bg-white print:items-start print:justify-start">
            <WorkOrderTemplate invoice={invoice} />
            <script dangerouslySetInnerHTML={{ __html: 'window.print();' }} />
        </div>
    )
}
