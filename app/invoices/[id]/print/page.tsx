import { getInvoiceById } from "@/actions/invoice-actions"
import { getCompanySettings } from "@/actions/settings-actions"
import { notFound } from "next/navigation"
import { InvoiceTemplate } from "@/components/modules/invoices/invoice-template"
import type { Invoice } from "@/types"

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const invoice = await getInvoiceById(id) as Invoice | null
    const settings = await getCompanySettings()

    if (!invoice) return notFound()

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center print:bg-white print:items-start print:justify-start">
            <InvoiceTemplate invoice={invoice} settings={settings} />
            <script dangerouslySetInnerHTML={{ __html: 'window.print();' }} />
        </div>
    )
}
