"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useInvoicePrint } from "@/hooks/use-invoice-print"
import {
    PaymentReceiptTemplate,
    type PaymentReceiptData,
} from "./payment-receipt-template"

export interface UsePaymentReceiptPrinterResult {
    printReceipt: (data: PaymentReceiptData) => void
    printingId: string | null
    isPrinting: boolean
    receiptElement: ReactNode
}

export function usePaymentReceiptPrinter(): UsePaymentReceiptPrinterResult {
    const [receipt, setReceipt] = useState<PaymentReceiptData | null>(null)
    const [printingId, setPrintingId] = useState<string | null>(null)
    const [printToken, setPrintToken] = useState<number>(0)
    const contentRef = useRef<HTMLDivElement>(null)
    const mountedRef = useRef(true)

    const { print } = useInvoicePrint({ contentRef, format: "ticket" })
    const printRef = useRef(print)
    printRef.current = print

    useEffect(() => {
        return () => {
            mountedRef.current = false
        }
    }, [])

    useEffect(() => {
        if (printToken === 0) return

        const handle = requestAnimationFrame(async () => {
            try {
                await printRef.current()
            } catch (err) {
                console.error("Error during receipt printing:", err)
            } finally {
                if (mountedRef.current) {
                    setPrintingId(null)
                }
            }
        })

        return () => {
            cancelAnimationFrame(handle)
        }
    }, [printToken])

    const printReceipt = useCallback((data: PaymentReceiptData) => {
        setPrintingId(data.paymentId)
        setReceipt(data)
        setPrintToken((prev) => prev + 1)
    }, [])

    const receiptElement = receipt ? (
        <div
            style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
            aria-hidden="true"
        >
            <div ref={contentRef}>
                <PaymentReceiptTemplate receipt={receipt} />
            </div>
        </div>
    ) : null

    return {
        printReceipt,
        printingId,
        isPrinting: Boolean(printingId),
        receiptElement,
    }
}
