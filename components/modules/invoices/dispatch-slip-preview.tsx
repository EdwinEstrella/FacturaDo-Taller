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
import { Component, useRef, type ReactNode } from "react"
import { useReactToPrint } from "react-to-print"
import { DispatchSlipTemplate } from "./dispatch-slip-template"

class DispatchSlipPreviewErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    state = { hasError: false }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    render() {
        if (this.state.hasError) {
            return <p className="p-4 text-sm text-muted-foreground">No se pudo cargar la vista previa del conduce.</p>
        }

        return this.props.children
    }
}

interface DispatchSlipPreviewDialogProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoice: any
    settings?: {
        companyName: string
        companyRnc: string
        companyPhone: string
        companyAddress: string
        companyLogo?: string
    }
}

export function DispatchSlipPreviewDialog({ invoice, settings }: DispatchSlipPreviewDialogProps) {
    const contentRef = useRef<HTMLDivElement>(null)
    const reactToPrintFn = useReactToPrint({ contentRef })

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Imprimir Conduce de Entrega">
                    <FileText className="h-4 w-4 text-orange-600" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden" style={{ maxWidth: '900px', width: '95vw' }}>
                <DialogHeader>
                    <DialogTitle>Vista Previa de Conduce de Entrega</DialogTitle>
                </DialogHeader>

                <div className="border p-4 bg-gray-50 overflow-auto">
                    <div ref={contentRef}>
                        <DispatchSlipPreviewErrorBoundary>
                            <DispatchSlipTemplate invoice={invoice} settings={settings} />
                        </DispatchSlipPreviewErrorBoundary>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button onClick={() => reactToPrintFn && reactToPrintFn()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir Conduce
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
