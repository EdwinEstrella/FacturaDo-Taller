"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"
import { z } from "zod"
import { Database } from "@/lib/supabase/database.types"

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
    const supabase = await createClient()

    const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0)

    try {
        // Create Credit Note
        const { data: creditNote, error: creditNoteError } = await supabase
            .from('CreditNote')
            .insert({
                invoiceId,
                reason,
                total,
                items: items as any, // Stored as JSON
            })
            .select()
            .single()

        if (creditNoteError || !creditNote) {
            throw creditNoteError
        }

        // Restore Stock if requested
        if (restoreStock) {
            for (const item of items) {
                const { data: product } = await supabase
                    .from('Product')
                    .select('stock')
                    .eq('id', item.productId)
                    .single()

                if (product) {
                    await supabase
                        .from('Product')
                        .update({ stock: product.stock + item.quantity })
                        .eq('id', item.productId)
                }
            }
        }

        revalidatePath("/credit-notes")
        revalidatePath("/invoices")
        return { success: true, creditNote }

    } catch (error) {
        console.error("Credit Note error:", error)
        return { success: false, error: "Error al crear Nota de Crédito" }
    }
}

export async function getCreditNoteById(id: string) {
    const supabase = await createClient()

    try {
        const { data: creditNote, error } = await supabase
            .from('CreditNote')
            .select(`
                *,
                invoice:Invoice(
                    *,
                    client:Client(*)
                )
            `)
            .eq('id', id)
            .single()

        if (error || !creditNote) {
            return null
        }

        return creditNote
    } catch (error) {
        console.error("Error fetching credit note:", error)
        return null
    }
}
