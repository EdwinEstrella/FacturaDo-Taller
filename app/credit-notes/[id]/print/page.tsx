import { getCreditNoteById } from "@/actions/credit-note-actions"
import { getCompanySettings } from "@/actions/settings-actions"
import { notFound } from "next/navigation"
import { CreditNoteTemplate } from "@/components/modules/credit-notes/credit-note-template"

export default async function PrintCreditNotePage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    const creditNote = await getCreditNoteById(id)
    const settings = await getCompanySettings()

    if (!creditNote) return notFound()

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center print:bg-white print:items-start print:justify-start">
            <CreditNoteTemplate creditNote={creditNote} settings={settings} />
            <script dangerouslySetInnerHTML={{ __html: 'window.print();' }} />
        </div>
    )
}
