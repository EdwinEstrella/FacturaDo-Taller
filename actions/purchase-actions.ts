"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "./auth-actions"

// --- Schemas ---

const PurchaseItemSchema = z.object({
    productId: z.string(),
    quantity: z.number().min(1),
    quantityType: z.enum(["UNIT", "BOX", "MEASURE"]).default("UNIT"),
    unitCost: z.number().min(0),
    newCost: z.number().optional(), // New Weighted Average Cost to save
    newPrice: z.number().optional() // New Selling Price to save
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

// --- Actions ---

export async function getSuppliers() {
    return await prisma.supplier.findMany({
        orderBy: { name: 'asc' }
    })
}

export async function createSupplier(data: z.infer<typeof SupplierSchema>) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const validated = SupplierSchema.safeParse(data)
    if (!validated.success) return { success: false, error: validated.error.message }

    try {
        const supplier = await prisma.supplier.create({
            data: validated.data
        })
        revalidatePath("/liquidations") // Updating the relevant page (now serving purchases)
        return { success: true, supplier }
    } catch (e) {
        console.error(e)
        return { success: false, error: "Failed to create supplier" }
    }
}

export async function createPurchase(data: z.infer<typeof PurchaseSchema>) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    // Validation
    const validated = PurchaseSchema.safeParse(data)
    if (!validated.success) return { success: false, error: validated.error.message }

    const { supplierId, supplierName, date, items, notes } = validated.data

    // Calculate Total
    const total = items.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0)

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Create Purchase Record
            const purchase = await tx.purchase.create({
                data: {
                    supplierId,
                    supplierName,
                    date,
                    total,
                    notes,
                    status: "COMPLETED",
                    items: {
                        create: items.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            quantityType: item.quantityType,
                            unitCost: item.unitCost,
                            total: item.quantity * item.unitCost
                        }))
                    }
                }
            })

            // 2. Update Inventory & Cost for each product
            for (const item of items) {
                // Prepare update data
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updateData: any = {
                    stock: { increment: item.quantity }
                }

                // If newCost is provided (Calculated Weighted Average), update Base Cost
                if (item.newCost !== undefined) {
                    updateData.cost = item.newCost
                } else {
                    // Fallback: If no average logic sent, possibly just update to latest? 
                    // Keeping old behavior strictly requires no change, but we want to update cost.
                    // If client didn't send newCost, we might default to unitCost (LPP) or leave as is.
                    // Let's default to updating to unitCost if no specific newCost sent to ensure cost moves.
                    updateData.cost = item.unitCost
                }

                // If newPrice is provided, update Selling Price
                if (item.newPrice !== undefined) {
                    updateData.price = item.newPrice
                }

                await tx.product.update({
                    where: { id: item.productId },
                    data: updateData
                })
            }

            // 3. Create Expense Transaction
            await tx.transaction.create({
                data: {
                    type: "EXPENSE",
                    category: "PURCHASE",
                    amount: total,
                    description: `Compra de Mercancía #${purchase.sequenceNumber} - ${supplierName || 'Proveedor'}`,
                    date: date,
                    referenceId: purchase.id
                }
            })
        })

        revalidatePath("/liquidations")
        revalidatePath("/products")
        revalidatePath("/finanzas") // Assuming transactions are shown here
        return { success: true }

    } catch (e) {
        console.error("Create Purchase Error:", e)
        return { success: false, error: "Failed to create purchase" }
    }
}
