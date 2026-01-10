"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"
import { z } from "zod"
// import { redirect } from "next/navigation"

const CreditNoteItemSchema = z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().min(1),
    price: z.number(),
})

const CreditNoteSchema = z.object({
    invoiceId: z.string(),
    reason: z.string(),
    items: z.array(CreditNoteItemSchema),
    restoreStock: z.boolean(),
})

type CreditNoteFormData = z.infer<typeof CreditNoteSchema>

export async function createCreditNote(data: CreditNoteFormData) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const validated = CreditNoteSchema.safeParse(data)
    if (!validated.success) return { success: false, error: validated.error.message }

    const { invoiceId, reason, items, restoreStock } = validated.data

    // Calculate total from items
    const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0)

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Credit Note
            const creditNote = await tx.creditNote.create({
                data: {
                    invoiceId,
                    reason,
                    total,
                    items: items, // Stored as JSON
                }
            })

            // 2. Restore Stock if requested
            if (restoreStock) {
                for (const item of items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quantity } }
                    })
                }
            }

            // 3. Update Invoice?
            // Optionally mark invoice as "Has Credit Note" or similar if schema supports.
            // Currently CreditNote has relation to Invoice, so we can check that way.
            // Also might want to adjust Invoice Balance if it was unpaid?
            // If it was PAID, this creates a "Balance in Favor" theoretically, or just a refund record.
            // For now, simple record.

            return creditNote
        })

        revalidatePath("/credit-notes")
        revalidatePath("/invoices")
        return { success: true, creditNote: result }

    } catch (error) {
        console.error("Credit Note error:", error)
        return { success: false, error: "Error al crear Nota de Crédito" }
    }
}
