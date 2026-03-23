"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "./auth-actions"
import { Database } from "@/lib/supabase/database.types"

const PurchaseItemSchema = z.object({
    productId: z.string(),
    quantity: z.number().min(1),
    quantityType: z.enum(["UNIT", "BOX", "MEASURE"]).default("UNIT"),
    unitCost: z.number().min(0),
    newCost: z.number().optional(),
    newPrice: z.number().optional()
})

const PurchaseSchema = z.object({
    supplierId: z.string().optional(),
    supplierName: z.string().optional(),
    date: z.date(),
    items: z.array(PurchaseItemSchema).min(1),
    notes: z.string().optional(),
})

const SupplierSchema = z.object({
    name: z.string().min(2),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    address: z.string().optional(),
})

export async function getSuppliers() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('Supplier')
        .select('*')
        .order('name', { ascending: true })

    if (error) {
        console.error(error)
        return []
    }

    return data || []
}

export async function createSupplier(data: z.infer<typeof SupplierSchema>) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const validated = SupplierSchema.safeParse(data)
    if (!validated.success) return { success: false, error: validated.error.message }

    const supabase = await createClient()

    try {
        const { data: supplier, error } = await supabase
            .from('Supplier')
            .insert(validated.data)
            .select()
            .single()

        if (error || !supplier) {
            throw error
        }

        revalidatePath("/liquidations")
        return { success: true, supplier }
    } catch (e) {
        console.error(e)
        return { success: false, error: "Failed to create supplier" }
    }
}

export async function createPurchase(data: z.infer<typeof PurchaseSchema>) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const validated = PurchaseSchema.safeParse(data)
    if (!validated.success) return { success: false, error: validated.error.message }

    const { supplierId, supplierName, date, items, notes } = validated.data
    const supabase = await createClient()

    const total = items.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0)

    try {
        // Create Purchase Record
        const { data: purchase, error: purchaseError } = await supabase
            .from('Purchase')
            .insert({
                supplierId,
                supplierName,
                date: date.toISOString(),
                total,
                notes,
                status: "COMPLETED",
            })
            .select()
            .single()

        if (purchaseError || !purchase) {
            throw purchaseError
        }

        // Create Purchase Items
        const purchaseItems = items.map(item => ({
            purchaseId: purchase.id,
            productId: item.productId,
            quantity: item.quantity,
            quantityType: item.quantityType,
            unitCost: item.unitCost,
            total: item.quantity * item.unitCost
        }))

        const { error: itemsError } = await supabase
            .from('PurchaseItem')
            .insert(purchaseItems)

        if (itemsError) {
            throw itemsError
        }

        // Update Inventory & Cost for each product
        for (const item of items) {
            const { data: product } = await supabase
                .from('Product')
                .select('*')
                .eq('id', item.productId)
                .single()

            if (!product) continue

            const updateData: Database['public']['Tables']['Product']['Update'] = {
                stock: product.stock + item.quantity
            }

            if (item.newCost !== undefined) {
                updateData.cost = item.newCost
            } else {
                updateData.cost = item.unitCost
            }

            if (item.newPrice !== undefined) {
                updateData.price = item.newPrice
            }

            await supabase
                .from('Product')
                .update(updateData)
                .eq('id', item.productId)
        }

        // Create Expense Transaction
        await supabase
            .from('Transaction')
            .insert({
                type: "EXPENSE",
                category: "PURCHASE",
                amount: total,
                description: `Compra de Mercancía #${purchase.sequenceNumber} - ${supplierName || 'Proveedor'}`,
                date: date.toISOString(),
                referenceId: purchase.id
            })

        revalidatePath("/liquidations")
        revalidatePath("/products")
        revalidatePath("/finanzas")
        return { success: true }

    } catch (e) {
        console.error("Create Purchase Error:", e)
        return { success: false, error: "Failed to create purchase" }
    }
}
