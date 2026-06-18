"use server"


import { requireAuth } from "@/actions/auth-actions";
import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"
import { z } from "zod"


const CreditNoteItemSchema = z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().min(1),
    price: z.number(),
    variantId: z.string().optional(),
})

const CreditNoteSchema = z.object({
    invoiceId: z.string(),
    reason: z.string(),
    items: z.array(CreditNoteItemSchema),
    restoreStock: z.boolean(),
})

type CreditNoteFormData = z.infer<typeof CreditNoteSchema>

type DatabaseClient = ReturnType<typeof createServerClient>

type CreditNoteInventoryItem = z.infer<typeof CreditNoteItemSchema>

async function syncProductStockFromVariants(insforge: DatabaseClient, productId: string) {
    await insforge.database.rpc("sync_product_stock_from_variants", { p_product_id: productId })
}

async function restoreCreditNoteStock(insforge: DatabaseClient, item: CreditNoteInventoryItem) {
    if (item.variantId) {
        const { data: variant } = await insforge.database
            .from('ProductVariant')
            .select('stock')
            .eq('id', item.variantId)
            .single()

        if (!variant) return

        await insforge.database
            .from('ProductVariant')
            .update({ stock: Number(variant.stock || 0) + item.quantity })
            .eq('id', item.variantId)

        await syncProductStockFromVariants(insforge, item.productId)
        return
    }

    const { data: product } = await insforge.database
        .from('Product')
        .select('stock')
        .eq('id', item.productId)
        .single()

    if (product) {
        await insforge.database
            .from('Product')
            .update({ stock: Number(product.stock || 0) + item.quantity })
            .eq('id', item.productId)
    }
}

export async function createCreditNote(data: CreditNoteFormData) {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const validated = CreditNoteSchema.safeParse(data)
    if (!validated.success) return { success: false, error: validated.error.message }

    const { invoiceId, reason, items, restoreStock } = validated.data
    const insforge = createServerClient()

    const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0)

    try {
        // Create Credit Note
        const { data: creditNote, error: creditNoteError } = await insforge.database
            .from('CreditNote')
            .insert([{
                invoiceId,
                reason,
                total,
                items: items as unknown, // Stored as JSON
            }])
            .select()
            .single()

        if (creditNoteError || !creditNote) {
            throw creditNoteError
        }

        // Restore Stock if requested
        if (restoreStock) {
            for (const item of items) {
                await restoreCreditNoteStock(insforge, item)
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
    await requireAuth();

    const insforge = createServerClient()

    try {
        const { data: creditNote, error } = await insforge.database
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
