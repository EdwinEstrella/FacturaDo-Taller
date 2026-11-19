"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useInvoicePrint } from "@/hooks/use-invoice-print"
import {
    PaymentReceiptTemplate,
    type PaymentReceiptData,
} from "./payment-receipt-template"

export interface UsePaymentReceiptPrinterResult {
    printReceipt: (data: PaymentReceiptData) => void
    printingId: string | null
    isPrinting: boolean
    ReceiptPortal: () => React.JSX.Element | null
}

export function usePaymentReceiptPrinter(): UsePaymentReceiptPrinterResult {
    const [receipt, setReceipt] = useState<PaymentReceiptData | null>(null)
    const [printingId, setPrintingId] = useState<string | null>(null)
    const [printToken, setPrintToken] = useState<number>(0)
    const contentRef = useRef<HTMLDivElement>(null)
    const activeTokenRef = useRef<number>(0)

    const { print } = useInvoicePrint({ contentRef, format: "ticket" })

    useEffect(() => {
        if (!receipt || printToken === 0) return
        if (activeTokenRef.current === printToken) return
        activeTokenRef.current = printToken

        let cancelled = false

        // Wait for DOM commit and layout
        const handle = requestAnimationFrame(async () => {
            try {
                if (cancelled) return
                await print()
            } catch (err) {
                console.error("Error during receipt printing:", err)
            } finally {
                if (!cancelled) {
                    setPrintingId(null)
                }
            }
        })

        return () => {
            cancelled = true
            cancelAnimationFrame(handle)
        }
    }, [receipt, printToken, print])

    const printReceipt = useCallback((data: PaymentReceiptData) => {
        setPrintingId(data.paymentId)
        setReceipt(data)
        setPrintToken((prev) => prev + 1)
    }, [])

    const ReceiptPortal = useCallback(() => {
        if (!receipt) return null
        return (
            <div
                style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
                aria-hidden="true"
            >
                <div ref={contentRef}>
                    <PaymentReceiptTemplate receipt={receipt} />
                </div>
            </div>
        )
    }, [receipt])

    return {
        printReceipt,
        printingId,
        isPrinting: Boolean(printingId),
        ReceiptPortal,
    }
}
