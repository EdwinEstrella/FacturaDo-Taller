"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Printer } from "lucide-react"
import { useRef, useState } from "react"
import { useReactToPrint } from "react-to-print"
import { InvoiceTemplate } from "./invoice-template"
import { InvoiceOdooTemplate } from "./invoice-odoo-template"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function InvoicePreviewDialog({ invoice, settings }: { invoice: any, settings?: any }) {
    const contentRef = useRef<HTMLDivElement>(null)
    const reactToPrintFn = useReactToPrint({ contentRef })

    const initialTemplate: "ticket" | "a4-odoo" = "ticket"
    const [template, setTemplate] = useState<"ticket" | "a4-odoo">(initialTemplate)

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Imprimir">
                    <Printer className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Vista Previa de Factura</DialogTitle>
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
                            <SelectItem value="a4-odoo">Factura A4</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="border p-2 bg-gray-100 flex justify-center">
                    <div ref={contentRef}>
                        {template === "ticket" ? (
                            <InvoiceTemplate invoice={invoice} settings={settings} />
                        ) : (
                            <InvoiceOdooTemplate invoice={invoice} settings={settings} />
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button onClick={() => reactToPrintFn && reactToPrintFn()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
