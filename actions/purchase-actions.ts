"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "./auth-actions"

// --- Schemas ---

const PurchaseItemSchema = z.object({
    productId: z.string(),
    quantity: z.number().min(1),
    unitCost: z.number().min(0),
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
                            unitCost: item.unitCost,
                            total: item.quantity * item.unitCost
                        }))
                    }
                }
            })

            // 2. Update Inventory & Cost for each product
            for (const item of items) {
                // Determine new cost: simple approach is Last Purchase Price.
                // Could also do Weighted Average, but LPP is safer/simpler for now unless specified.
                // "Liquidating merchandise" usually implies setting the new cost basis.

                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: { increment: item.quantity },
                        cost: item.unitCost // Updating Base Cost
                    }
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
