import { getInvoiceById } from "@/actions/invoice-actions"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { WorkOrderTemplate } from "@/components/modules/orders/work-order-template"

export default async function PrintWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    // Fetch Invoice AND WorkOrder. id here is INVOICE ID based on route /invoices/[id]/...
    const invoice: any = await prisma.invoice.findUnique({
        where: { id },
        include: {
            client: true,
            items: true,
            workOrder: true
        }
    })

    if (!invoice || !invoice.workOrder) return notFound()

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center print:bg-white print:items-start print:justify-start">
            <WorkOrderTemplate invoice={invoice} />
            <script dangerouslySetInnerHTML={{ __html: 'window.print();' }} />
        </div>
    )
}
