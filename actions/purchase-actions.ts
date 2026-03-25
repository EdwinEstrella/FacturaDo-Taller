"use server"

import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "./auth-actions"


const PurchaseItemSchema = z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    variantName: z.string().optional(),
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
    const insforge = createServerClient()

    const { data, error } = await insforge.database
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

    const insforge = createServerClient()

    try {
        const { data: supplier, error } = await insforge.database
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

    const { supplierName, date, items, notes } = validated.data
    const insforge = createServerClient()

    const total = items.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0)

    try {
        // Get products to fetch names
        const { data: products } = await insforge.database
            .from('Product')
            .select('id, name')
            .in('id', items.map(item => item.productId))

        // Create Purchase Record
        const { data: purchase, error: purchaseError } = await insforge.database
            .from('Purchase')
            .insert([{
                supplierName: supplierName || "Proveedor",
                total: total.toString(),
                notes,
            }])
            .select()
            .single()

        if (purchaseError || !purchase) {
            throw purchaseError
        }

        // Create Purchase Items
        const purchaseItems = items.map(item => {
            const product = products?.find(p => p.id === item.productId)

            // If there's a variant, include its name in the product name
            let productName = product?.name || "Producto"
            if (item.variantName) {
                productName = `${productName} - ${item.variantName}`
            }

            return {
                purchaseId: purchase.id,
                productId: item.productId,
                productName: productName,
                quantity: item.quantity,
                price: item.unitCost.toString()
            }
        })

        const { error: itemsError } = await insforge.database
            .from('PurchaseItem')
            .insert(purchaseItems)

        if (itemsError) {
            throw itemsError
        }

        // Update Inventory & Cost for each product
        for (const item of items) {
            const { data: product } = await insforge.database
                .from('Product')
                .select('*')
                .eq('id', item.productId)
                .single()

            if (!product) continue

            const updateData: Record<string, string | number> = {
                stock: product.stock + item.quantity
            }

            if (item.newCost !== undefined) {
                updateData.cost = item.newCost.toString()
            } else {
                updateData.cost = item.unitCost.toString()
            }

            if (item.newPrice !== undefined) {
                updateData.price = item.newPrice.toString()
            }

            await insforge.database
                .from('Product')
                .update(updateData)
                .eq('id', item.productId)
        }

        // Create Expense Transaction
        await insforge.database
            .from('Transaction')
            .insert([{
                type: "EXPENSE",
                category: "PURCHASE",
                amount: total,
                description: `Compra de Mercancía - ${supplierName || 'Proveedor'}`,
                date: date.toISOString(),
                reference_id: purchase.id
            }])

        revalidatePath("/liquidations")
        revalidatePath("/products")
        revalidatePath("/finanzas")
        return { success: true }

    } catch (e) {
        console.error("Create Purchase Error:", e)
        return { success: false, error: "Failed to create purchase" }
    }
}
