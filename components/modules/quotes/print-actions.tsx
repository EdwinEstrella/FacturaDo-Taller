"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Printer, FileDown } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExportPdfModal } from "@/components/modules/pdf/export-pdf-modal"

interface PrintActionsProps {
    quoteId: string
    currentTemplate: string
}

export function PrintActions({ quoteId, currentTemplate }: PrintActionsProps) {
    const router = useRouter()
    const [pdfModalOpen, setPdfModalOpen] = useState(false)

    const changeTemplate = (template: string) => {
        router.push(`/quotes/${quoteId}/print?template=${template}`)
    }

    return (
        <div className="w-full max-w-4xl mb-4 flex flex-wrap gap-2 items-center justify-between no-print">
            <Link href="/quotes">
                <Button variant="outline" size="sm">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                </Button>
            </Link>
            <div className="flex flex-wrap gap-2 items-center ml-auto">
                <Button
                    variant={currentTemplate === "ticket" ? "default" : "outline"}
                    size="sm"
                    onClick={() => changeTemplate("ticket")}
                >
                    Ticket 80mm
                </Button>
                <Button
                    variant={currentTemplate === "a4" ? "default" : "outline"}
                    size="sm"
                    onClick={() => changeTemplate("a4")}
                >
                    A4
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPdfModalOpen(true)}
                >
                    <FileDown className="mr-2 h-4 w-4 text-blue-600" />
                    Guardar como PDF
                </Button>
                <Button onClick={() => window.print()} size="sm">
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir
                </Button>
            </div>

            <ExportPdfModal
                open={pdfModalOpen}
                onOpenChange={setPdfModalOpen}
                title="Exportar Cotización a PDF"
                defaultFilename={`Cotizacion-${quoteId}.pdf`}
                initialFormat={currentTemplate === "ticket" ? "ticket" : "a4"}
                getHtmlContent={() => {
                    const el = document.getElementById("printable-quote-content");
                    return el?.innerHTML || "";
                }}
            />
        </div>
    )
}
