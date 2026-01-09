"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { FileText, Printer } from "lucide-react"
import { useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { WorkOrderTemplate } from "./work-order-template"

export function WorkOrderPreviewDialog({ invoice }: { invoice: any }) {
    const contentRef = useRef<HTMLDivElement>(null)
    const reactToPrintFn = useReactToPrint({ contentRef })

    if (!invoice.workOrder) return null

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Imprimir Conduce">
                    <FileText className="h-4 w-4 text-orange-600" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Vista Previa de Conduce</DialogTitle>
                </DialogHeader>

                <div className="border p-4 bg-gray-50 overflow-auto">
                    <div ref={contentRef}>
                        <WorkOrderTemplate invoice={invoice} />
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
