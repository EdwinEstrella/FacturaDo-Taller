import { getCreditNoteById } from "@/actions/credit-note-actions"
import { getCompanySettings } from "@/actions/settings-actions"
import Script from "next/script"
import { notFound } from "next/navigation"
import { CreditNoteTemplate } from "@/components/modules/credit-notes/credit-note-template"

export default async function PrintCreditNotePage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    const [creditNote, settings] = await Promise.all([
        getCreditNoteById(id),
        getCompanySettings()
    ])

    if (!creditNote) return notFound()

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center print:bg-white print:items-start print:justify-start">
            <CreditNoteTemplate creditNote={creditNote} settings={settings} />
            <Script id="print-script" strategy="afterInteractive">
                {`window.print();`}
            </Script>
        </div>
    )
}
