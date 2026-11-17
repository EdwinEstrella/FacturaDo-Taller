"use client"

import { useEffect, useState } from "react"
import { getInvoiceEcfPrint } from "@/actions/ecf-print-actions"
import { isElectronicNcf, type EcfPrintData } from "@/lib/fiscal/printed/ecf-print-data"

const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 40

/**
 * Loads the DGII stamp of an electronic invoice and keeps polling while the fiscal worker signs it.
 * Returns null for invoices without an e-NCF (nothing to wait for). Pass active=false while the
 * print UI is closed so list rows do not poll.
 */
export function useEcfPrintData(invoiceId: string | null | undefined, ncf: string | null | undefined, active = true) {
    const enabled = active && Boolean(invoiceId && isElectronicNcf(ncf))
    const [data, setData] = useState<EcfPrintData | null>(null)

    useEffect(() => {
        if (!enabled || !invoiceId) return
        let cancelled = false
        let polls = 0
        let timer: ReturnType<typeof setTimeout> | null = null

        const load = async () => {
            try {
                const result = await getInvoiceEcfPrint(invoiceId)
                if (cancelled) return
                setData(result)
                if (result.state === "pending" && ++polls < MAX_POLLS) {
                    timer = setTimeout(load, POLL_INTERVAL_MS)
                }
            } catch {
                if (!cancelled && ++polls < MAX_POLLS) timer = setTimeout(load, POLL_INTERVAL_MS)
            }
        }
        void load()

        return () => {
            cancelled = true
            if (timer) clearTimeout(timer)
        }
    }, [enabled, invoiceId])

    if (!enabled) return { ecf: null, waiting: false }
    return { ecf: data, waiting: !data || data.state === "pending" }
}
