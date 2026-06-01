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
    if (!user || (user.role !== "ADMIN" && user.role !== "ACCOUNTANT" && user.role !== "MANAGER")) {
        return { success: false, error: "No tienes permisos para crear proveedores" }
    }

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
    if (!user || (user.role !== "ADMIN" && user.role !== "ACCOUNTANT" && user.role !== "MANAGER")) {
        return { success: false, error: "No tienes permisos para registrar compras" }
    }

    const validated = PurchaseSchema.safeParse(data)
    if (!validated.success) return { success: false, error: validated.error.message }

    const { supplierName, date, items, notes } = validated.data
    const insforge = createServerClient()

    const total = items.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0)

    try {
        const { error } = await insforge.database.rpc("record_purchase_atomic", {
            p_supplier_name: supplierName || "Proveedor",
            p_total: total,
            p_notes: notes || null,
            p_date: date.toISOString(),
            p_items: items.map(item => ({
                productId: item.productId,
                variantId: item.variantId || null,
                variantName: item.variantName || null,
                quantity: item.quantity,
                quantityType: item.quantityType,
                unitCost: item.unitCost,
                newCost: item.newCost ?? null,
                newPrice: item.newPrice ?? null,
            })),
        })

        if (error) {
            throw new Error(error.message)
        }

        revalidatePath("/liquidations")
        revalidatePath("/products")
        revalidatePath("/finanzas")
        return { success: true }

    } catch (e) {
        console.error("Create Purchase Error:", e)
        return { success: false, error: "Failed to create purchase" }
    }
}
