"use client"

import { useState, useRef } from "react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { FileDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ExportPdfModal } from "@/components/modules/pdf/export-pdf-modal"
import { cn } from "@/lib/utils"

/**
 * Loads the cash-close print route inside a hidden iframe.
 * Replaces any existing frame and resolves once the iframe has loaded.
 */
export function loadCashCloseFrame(shiftId: string, query = ""): Promise<HTMLIFrameElement> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined") {
            reject(new Error("Cannot load frame in SSR"))
            return
        }

        const existing = document.getElementById("cc-print-frame")
        if (existing) {
            existing.remove()
        }

        const iframe = document.createElement("iframe")
        iframe.id = "cc-print-frame"
        iframe.style.position = "fixed"
        iframe.style.right = "0"
        iframe.style.bottom = "0"
        iframe.style.width = "0"
        iframe.style.height = "0"
        iframe.style.border = "0"

        iframe.onload = () => resolve(iframe)
        iframe.onerror = (err) => reject(err)
        iframe.src = `/daily-close/print/${shiftId}${query}`
        document.body.appendChild(iframe)
    })
}

/**
 * Prints the cash-close report silently or via the system dialog through an isolated iframe.
 */
export async function printCashCloseReport(shiftId: string, query = ""): Promise<void> {
    try {
        const iframe = await loadCashCloseFrame(shiftId, query)
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
    } catch {
        /* noop */
    }
}

export interface ExportCashClosePdfButtonProps {
    shiftId: string
    shiftNumber: number | string
    getQuery?: () => string
    size?: ButtonProps["size"]
    variant?: ButtonProps["variant"]
    className?: string
}

export function ExportCashClosePdfButton({
    shiftId,
    shiftNumber,
    getQuery,
    size,
    variant = "outline",
    className,
}: ExportCashClosePdfButtonProps) {
    const [loading, setLoading] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)

    const handleClick = async () => {
        setLoading(true)
        try {
            const query = getQuery ? getQuery() : ""
            const iframe = await loadCashCloseFrame(shiftId, query)
            iframeRef.current = iframe
            setModalOpen(true)
        } catch (err) {
            console.error("Error loading cash-close report frame:", err)
            toast.error("Error al cargar el reporte para exportar a PDF")
        } finally {
            setLoading(false)
        }
    }

    const iconClass = size === "sm" ? "h-3.5 w-3.5 mr-1.5" : "h-4 w-4 mr-2"

    return (
        <>
            <Button
                variant={variant}
                size={size}
                className={className}
                onClick={handleClick}
                disabled={loading}
            >
                {loading ? (
                    <Loader2 className={cn(iconClass, "animate-spin")} />
                ) : (
                    <FileDown className={iconClass} />
                )}
                Exportar PDF
            </Button>

            <ExportPdfModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title="Exportar Cierre de Caja a PDF"
                defaultFilename={`Cierre-Turno-${shiftNumber}.pdf`}
                initialFormat="a4"
                getContentElement={() => {
                    const frame =
                        iframeRef.current ??
                        (typeof document !== "undefined"
                            ? (document.getElementById("cc-print-frame") as HTMLIFrameElement | null)
                            : null)
                    return (
                        (frame?.contentDocument?.querySelector(".cash-close-report") as HTMLElement | null) ??
                        null
                    )
                }}
            />
        </>
    )
}
