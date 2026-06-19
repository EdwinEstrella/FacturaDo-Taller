import { getQuoteById } from "@/actions/quote-actions"
import { getCompanySettings } from "@/actions/settings-actions"
import { notFound } from "next/navigation"
import { QuoteTemplate } from "@/components/modules/quotes/quote-template"
import { QuoteOdooTemplate } from "@/components/modules/quotes/quote-odoo-template"
import { PrintActions } from "@/components/modules/quotes/print-actions"

export default async function PrintQuotePage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ template?: string }>
}) {
    const settingsPromise = getCompanySettings()
    const [{ id }, { template }] = await Promise.all([params, searchParams])

    const [quote, settings] = await Promise.all([
        getQuoteById(id),
        settingsPromise
    ])

    if (!quote) return notFound()

    const templateId = template ? (template === "a4" ? "a4" : "ticket") : (settings.invoiceTemplate || "ticket")

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center print:bg-white print:items-start print:justify-start print:p-0 p-4 md:p-8 print:block">
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                }
            `}</style>

            {/* Botones de navegación - solo se muestran en pantalla */}
            <PrintActions quoteId={id} currentTemplate={templateId} />

            {/* Contenido de la cotización */}
            {templateId === "ticket" ? (
                <QuoteTemplate quote={quote} settings={settings} />
            ) : (
                <QuoteOdooTemplate quote={quote} settings={settings} />
            )}
        </div>
    )
}
