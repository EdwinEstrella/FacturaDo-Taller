"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Printer, FileDown } from "lucide-react"
import { useRef, useState } from "react"
import { useReactToPrint } from "react-to-print"
import { toast } from "sonner"
import { QuoteTemplate } from "./quote-template"
import { QuoteOdooTemplate } from "./quote-odoo-template"
import { ExportPdfModal } from "@/components/modules/pdf/export-pdf-modal"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { CompanySettings } from "@/actions/settings-actions"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function QuotePreviewDialog({ quote, settings }: { quote: any, settings?: CompanySettings }) {
    const contentRef = useRef<HTMLDivElement>(null)
    const reactToPrintFn = useReactToPrint({ contentRef })

    const initialTemplate: "ticket" | "a4-odoo" = settings?.invoiceTemplate === "a4" ? "a4-odoo" : "ticket"
    const [template, setTemplate] = useState<"ticket" | "a4-odoo">(initialTemplate)
    const [pdfModalOpen, setPdfModalOpen] = useState(false)

    const handlePrint = async () => {
        if (typeof window !== "undefined" && window.electron?.getPrinterConfig && contentRef.current) {
            try {
                const cfg = await window.electron.getPrinterConfig();
                const isThermal = template === "ticket";
                const selectedPrinter = isThermal ? cfg?.thermalPrinter : cfg?.a4Printer;

                if (selectedPrinter && selectedPrinter.trim() !== "") {
                    toast.info(`Imprimiendo en ${selectedPrinter}...`);
                    const res = await window.electron.printSilent?.({
                        html: contentRef.current.innerHTML,
                        deviceName: selectedPrinter.trim(),
                        format: isThermal ? "ticket" : "a4",
                    });
                    if (res?.success) {
                        toast.success("Impresión enviada correctamente");
                        return;
                    }
                }
            } catch (err) {
                console.warn("Fallo impresión silenciosa:", err);
            }
        }
        // Solo si no está configurada o falló, abre el diálogo habitual
        if (reactToPrintFn) {
            reactToPrintFn();
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Imprimir">
                    <Printer className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden" style={{ maxWidth: '900px', width: '95vw' }}>
                <DialogHeader>
                    <DialogTitle>Vista Previa de Cotización</DialogTitle>
                </DialogHeader>

                {/* Selector de tipo de impresión */}
                <div className="flex items-center justify-between mb-3 gap-4">
                    <div className="text-xs text-muted-foreground">
                        Tipo de impresión
                    </div>
                    <Select value={template} onValueChange={(v) => setTemplate(v as "ticket" | "a4-odoo")}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Selecciona formato" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ticket">Ticket 80mm (térmica)</SelectItem>
                            <SelectItem value="a4-odoo">Cotización A4</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="border p-2 bg-gray-100 flex justify-center">
                    <div ref={contentRef}>
                        {template === "ticket" ? (
                            <QuoteTemplate quote={quote} settings={settings} />
                        ) : (
                            <QuoteOdooTemplate quote={quote} settings={settings} />
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setPdfModalOpen(true)}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Guardar como PDF
                    </Button>
                    <Button onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                    </Button>
                </div>

                <ExportPdfModal
                    open={pdfModalOpen}
                    onOpenChange={setPdfModalOpen}
                    title="Exportar Cotización a PDF"
                    defaultFilename={`Cotizacion-${quote.sequenceNumber || quote.id || "documento"}.pdf`}
                    initialFormat={template === "ticket" ? "ticket" : "a4"}
                    getHtmlContent={() => contentRef.current?.innerHTML || ""}
                />
            </DialogContent>
        </Dialog>
    )
}
