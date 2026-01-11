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
import { useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { InvoiceTemplate } from "./invoice-template"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function InvoicePreviewDialog({ invoice, settings }: { invoice: any, settings?: any }) {
    const contentRef = useRef<HTMLDivElement>(null)
    const reactToPrintFn = useReactToPrint({ contentRef })

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Imprimir Ticket">
                    <Printer className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[400px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Vista Previa de Factura</DialogTitle>
                </DialogHeader>

                <div className="border p-2 bg-gray-100 flex justify-center">
                    <div ref={contentRef}>
                        <InvoiceTemplate invoice={invoice} settings={settings} />
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
