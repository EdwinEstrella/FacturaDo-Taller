import { getInvoiceById } from "@/actions/invoice-actions"
import { getCompanySettings } from "@/actions/settings-actions"
import { notFound } from "next/navigation"
import Script from "next/script"
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
    const settingsPromise = getCompanySettings()
    const [{ id }, { template }] = await Promise.all([params, searchParams])

    const [invoice, settings] = await Promise.all([
        getInvoiceById(id) as Promise<Invoice | null>,
        settingsPromise
    ])

    if (!invoice) return notFound()

    const templateId = template ? (template === "a4" ? "a4" : "ticket") : (settings.invoiceTemplate || "ticket")

    return (
        <div data-print-format={templateId} className="min-h-screen bg-gray-100 flex items-center justify-center print:bg-white print:items-start print:justify-start">
            {templateId === "ticket" ? (
                <InvoiceTemplate invoice={invoice} settings={settings} />
            ) : (
                <InvoiceOdooTemplate invoice={invoice} settings={settings} />
            )}
            <Script id="print-script" strategy="afterInteractive">
                {`window.print();`}
            </Script>
        </div>
    )
}
