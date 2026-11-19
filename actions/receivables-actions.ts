"use server"

import { requireAuth } from "@/actions/auth-actions"
import { createServerClient } from "@/lib/insforge/client"
import { computeInvoiceBalance } from "@/lib/receivables/invoice-balance"
import { getCompanySettings, type CompanySettings } from "@/actions/settings-actions"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"
import { z } from "zod"

const PaymentSchema = z.object({
    invoiceId: z.string(),
    amount: z.number().min(0.01),
    method: z.string(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    date: z.coerce.date().optional(),
})

type PaymentFormData = z.infer<typeof PaymentSchema>

export async function registerPayment(data: PaymentFormData) {
    await requireAuth()

    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const validated = PaymentSchema.safeParse(data)
    if (!validated.success) return { success: false, error: validated.error.message }

    const { invoiceId, amount, method, reference, notes, date } = validated.data
    const insforge = createServerClient()

    // Verificar si hay un turno de caja abierto
    const { data: openShifts } = await insforge.database
        .from('CashShift')
        .select('id')
        .eq('status', 'OPEN')
        .limit(1)

    if (!openShifts || openShifts.length === 0) {
        return { success: false, error: "No se puede registrar cobro: Debe abrir un turno de caja primero." }
    }

    try {
        // Derive current balance from total, existing payments, and credit notes
        const currentBalanceInfo = await computeInvoiceBalance(invoiceId, { insforge })

        if (amount > currentBalanceInfo.balance + 0.01) {
            return { success: false, error: "El monto excede el balance pendiente" }
        }

        // Create Payment and verify error
        const { data: newPayment, error: paymentError } = await insforge.database
            .from('Payment')
            .insert([{
                invoiceId,
                amount,
                method,
                reference: reference || null,
                notes: notes || null,
                date: (date || new Date()).toISOString(),
            }])
            .select()
            .single()

        if (paymentError || !newPayment) {
            console.error("Payment insert error:", paymentError)
            return { success: false, error: paymentError?.message || "Error al registrar el pago" }
        }

        // Recompute balance after payment insert
        const newBalanceInfo = await computeInvoiceBalance(invoiceId, { insforge })

        // Update Invoice with recomputed balance and status
        const { data: updatedInvoice, error: updateError } = await insforge.database
            .from('Invoice')
            .update({
                balance: newBalanceInfo.balance,
                status: newBalanceInfo.status,
            })
            .eq('id', invoiceId)
            .select()
            .single()

        if (updateError || !updatedInvoice) {
            console.error("Invoice balance update error:", updateError)
            return { success: false, error: updateError?.message || "Error al actualizar balance de la factura" }
        }

        revalidatePath("/receivables")
        revalidatePath("/invoices")

        return {
            success: true,
            paymentId: newPayment.id,
            invoice: updatedInvoice,
            balance: newBalanceInfo.balance,
            status: newBalanceInfo.status,
            totalPaid: newBalanceInfo.paid,
        }
    } catch (error) {
        console.error("Payment error:", error)
        return { success: false, error: error instanceof Error ? error.message : "Error al registrar pago" }
    }
}

export interface PaymentReceiptResult {
    invoice: {
        id: string
        sequenceNumber: number
        createdAt: string
        clientName: string
        total: number
    }
    payments: Array<{
        id: string
        amount: number
        method: string
        reference?: string | null
        notes?: string | null
        date: string
    }>
    paymentId: string
    totalPaid: number
    balance: number
    credited: number
    settings?: CompanySettings
}

export async function getPaymentReceipt(paymentId: string): Promise<{
    success: boolean
    data?: PaymentReceiptResult
    error?: string
}> {
    await requireAuth()

    const insforge = createServerClient()

    try {
        const { data: payment, error: paymentError } = await insforge.database
            .from('Payment')
            .select('*')
            .eq('id', paymentId)
            .single()

        if (paymentError || !payment) {
            return { success: false, error: "Pago no encontrado" }
        }

        const invoiceId = payment.invoiceId

        const { data: invoice, error: invoiceError } = await insforge.database
            .from('Invoice')
            .select('id, sequenceNumber, createdAt, clientName, total')
            .eq('id', invoiceId)
            .single()

        if (invoiceError || !invoice) {
            return { success: false, error: "Factura no encontrada" }
        }

        const { data: paymentRows, error: paymentsError } = await insforge.database
            .from('Payment')
            .select('id, amount, method, reference, notes, date, createdAt')
            .eq('invoiceId', invoiceId)
            .order('date', { ascending: true })

        if (paymentsError) {
            console.error("Error loading payments for receipt:", paymentsError)
        }

        const payments = (paymentRows || []).map((p: {
            id: string
            amount: number | string
            method: string
            reference?: string | null
            notes?: string | null
            date?: string | null
            createdAt?: string | null
        }) => ({
            id: p.id,
            amount: Number(p.amount || 0),
            method: p.method,
            reference: p.reference ?? null,
            notes: p.notes ?? null,
            date: p.date || p.createdAt || '',
        }))

        const balanceInfo = await computeInvoiceBalance(invoiceId, { insforge })
        const settings = await getCompanySettings()

        return {
            success: true,
            data: {
                invoice: {
                    id: invoice.id,
                    sequenceNumber: Number(invoice.sequenceNumber),
                    createdAt: invoice.createdAt,
                    clientName: invoice.clientName || "Consumidor Final",
                    total: Number(invoice.total || 0),
                },
                payments,
                paymentId,
                totalPaid: balanceInfo.paid,
                balance: balanceInfo.balance,
                credited: balanceInfo.credited,
                settings,
            }
        }
    } catch (error) {
        console.error("getPaymentReceipt error:", error)
        return { success: false, error: error instanceof Error ? error.message : "Error al obtener recibo de pago" }
    }
}
