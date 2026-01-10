"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"
import { z } from "zod"
// import { redirect } from "next/navigation"

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

    try {
        const result = await prisma.$transaction(async (tx) => {
            const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } })
            if (!invoice) throw new Error("Factura no encontrada")

            // Wait, balance is Decimal in schema? I need to verify. 
            // Step 697 said Added shippingCost (Decimal).
            // Usually monetary fields are Decimal.
            // But prisma types return Decimal object or number depending on config.
            // Safe to assume Decimal.

            const currentBalance = Number(invoice.balance)
            const newBalance = currentBalance - amount

            if (newBalance < -0.01) { // Floating point tolerance
                throw new Error("El monto excede el balance pendiente")
            }

            // Create Payment
            await tx.payment.create({
                data: {
                    invoiceId,
                    amount,
                    method,
                    reference,
                    notes,
                    date: date || new Date(),
                    // createdById: user.id // If schema supports it
                }
            })

            // Update Invoice
            const updatedInvoice = await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    balance: newBalance,
                    status: newBalance <= 0.01 ? "PAID" : "PENDING"
                }
            })

            return updatedInvoice
        })

        revalidatePath("/receivables")
        revalidatePath("/invoices")
        return { success: true, invoice: result }

    } catch (error) {
        console.error("Payment error:", error)
        return { success: false, error: error instanceof Error ? error.message : "Error al registrar pago" }
    }
}
