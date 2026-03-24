"use server"

import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"
import { z } from "zod"

const PaymentSchema = z.object({
    invoiceId: z.string(),
    amount: z.number().min(0.01),
    method: z.string(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    date: z.date().optional(),
})

type PaymentFormData = z.infer<typeof PaymentSchema>

export async function registerPayment(data: PaymentFormData) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const validated = PaymentSchema.safeParse(data)
    if (!validated.success) return { success: false, error: validated.error.message }

    const { invoiceId, amount, method, reference, notes, date } = validated.data
    const insforge = createServerClient()

    try {
        // Get invoice
        const { data: invoice } = await insforge.database
            .from('Invoice')
            .select('*')
            .eq('id', invoiceId)
            .single()

        if (!invoice) {
            throw new Error("Factura no encontrada")
        }

        const currentBalance = Number(invoice.balance)
        const newBalance = currentBalance - amount

        if (newBalance < -0.01) {
            throw new Error("El monto excede el balance pendiente")
        }

        // Create Payment
        await insforge.database
            .from('Payment')
            .insert([{
                invoiceId,
                amount,
                method,
                reference,
                notes,
                date: (date || new Date()).toISOString(),
            }])

        // Update Invoice
        const { data: updatedInvoice } = await insforge.database
            .from('Invoice')
            .update({
                balance: newBalance,
                status: newBalance <= 0.01 ? "PAID" : "PENDING"
            })
            .eq('id', invoiceId)
            .select()
            .single()

        revalidatePath("/receivables")
        revalidatePath("/invoices")
        return { success: true, invoice: updatedInvoice }

    } catch (error) {
        console.error("Payment error:", error)
        return { success: false, error: error instanceof Error ? error.message : "Error al registrar pago" }
    }
}
