import { getInvoiceById } from "@/actions/invoice-actions"
import { getCompanySettings } from "@/actions/settings-actions"
import { notFound } from "next/navigation"
import { InvoiceTemplate } from "@/components/modules/invoices/invoice-template"
import { InvoiceOdooTemplate } from "@/components/modules/invoices/invoice-odoo-template"
import type { Invoice } from "@/types"

export default async function PrintInvoicePage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ template?: string }>
}) {
    const { id } = await params
    const { template } = await searchParams

    const invoice = await getInvoiceById(id) as Invoice | null
    const settings = await getCompanySettings()

    if (!invoice) return notFound()

    const templateId = template === "a4" ? "a4" : "ticket"

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center print:bg-white print:items-start print:justify-start">
            {templateId === "ticket" ? (
                <InvoiceTemplate invoice={invoice} settings={settings} />
            ) : (
                <InvoiceOdooTemplate invoice={invoice} settings={settings} />
            )}
            <script dangerouslySetInnerHTML={{ __html: 'window.print();' }} />
        </div>
    )
}
