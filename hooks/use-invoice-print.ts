"use client"

import { useCallback } from "react"
import { useReactToPrint } from "react-to-print"
import { toast } from "sonner"
import { extractPrintData } from "@/lib/print-utils"

export type InvoicePrintFormat = "ticket" | "a4" | "a4-odoo"

export interface UseInvoicePrintOptions {
    contentRef: React.RefObject<HTMLDivElement | null>
    format: InvoicePrintFormat
}

export function useInvoicePrint({ contentRef, format }: UseInvoicePrintOptions) {
    const reactToPrintFn = useReactToPrint({ contentRef })

    const print = useCallback(async () => {
        if (typeof window !== "undefined" && window.electron?.getPrinterConfig && contentRef.current) {
            try {
                const cfg = await window.electron.getPrinterConfig()
                const isThermal = format === "ticket"
                const selectedPrinter = isThermal ? cfg?.thermalPrinter : cfg?.a4Printer

                if (selectedPrinter && selectedPrinter.trim() !== "") {
                    toast.info(`Imprimiendo en ${selectedPrinter}...`)
                    const printData = extractPrintData(contentRef.current, contentRef.current.innerHTML)
                    const res = await window.electron.printSilent?.({
                        html: printData.html,
                        deviceName: selectedPrinter.trim(),
                        format: isThermal ? "ticket" : "a4",
                        css: printData.css,
                        headTags: printData.headTags,
                        baseUrl: printData.baseUrl,
                    })
                    if (res?.success) {
                        toast.success("Impresión enviada correctamente")
                        return
                    }
                }
            } catch (err) {
                console.warn("Fallo impresión silenciosa:", err)
            }
        }

        // Solo si no está configurada o falló, abre el diálogo habitual
        if (reactToPrintFn) {
            reactToPrintFn()
        }
    }, [contentRef, format, reactToPrintFn])

    return { print }
}
