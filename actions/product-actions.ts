"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@prisma/client"

const ProductSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    price: z.coerce.number().min(0),
    stock: z.coerce.number().int().min(0),
    minStock: z.coerce.number().int().min(0).optional(),
    sku: z.string().optional(),
    // isService: z.boolean().optional(), // Removed from input, derived from category
    variants: z.string().optional(), // JSON string
    category: z.enum(["MATERIAL", "ARTICULO", "SERVICIO"]),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createProduct(prevState: any, formData: FormData) {
    const validatedFields = ProductSchema.safeParse({
        name: formData.get("name"),
        description: formData.get("description"),
        price: formData.get("price"),
        stock: formData.get("stock"),
        minStock: formData.get("minStock"),
        sku: formData.get("sku"),
        category: formData.get("category"),
        variants: formData.get("variants"),
    })

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        }
    }

    try {
        const { category, variants, ...rest } = validatedFields.data
        const parsedVariants = variants ? JSON.parse(variants) : []
        const hasVariants = parsedVariants.length > 0

        // Calculate total stock from variants if they exist
        const totalStock = hasVariants
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? parsedVariants.reduce((acc: number, v: any) => acc + (Number(v.stock) || 0), 0)
            : rest.stock

        await prisma.product.create({
            data: {
                ...rest,
                stock: totalStock,
                category,
                isService: category === "SERVICIO", // Auto-set based on category
                hasVariants,
                variants: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    create: parsedVariants.map((v: any) => ({
                        name: v.name,
                        price: v.price,
                        stock: v.stock,
                        sku: v.sku
                    }))
                }
            },
        })
        revalidatePath("/products")
        return { message: "Producto creado correctamente" }
    } catch (e) {
        console.error(e)
        return { message: "Failed to create product" }
    }
}

export async function getProducts() {
    return await prisma.product.findMany({
        include: { variants: true },
        orderBy: { name: 'asc' }
    })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateProduct(id: string, prevState: any, formData: FormData) {
    const validatedFields = ProductSchema.safeParse({
        name: formData.get("name"),
        description: formData.get("description"),
        price: formData.get("price"),
        stock: formData.get("stock"),
        minStock: formData.get("minStock"),
        sku: formData.get("sku"),
        category: formData.get("category"),
        variants: formData.get("variants"),
    })

    if (!validatedFields.success) {
        return { errors: validatedFields.error.flatten().fieldErrors }
    }

    try {
        const { category, variants, ...rest } = validatedFields.data
        const parsedVariants = variants ? JSON.parse(variants) : []
        const hasVariants = parsedVariants.length > 0

        // Calculate total stock from variants if they exist
        const totalStock = hasVariants
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? parsedVariants.reduce((acc: number, v: any) => acc + (Number(v.stock) || 0), 0)
            : rest.stock

        await prisma.$transaction(async (tx) => {
            // Update main product
            await tx.product.update({
                where: { id },
                data: {
                    ...rest,
                    stock: totalStock,
                    category,
                    isService: category === "SERVICIO",
                    hasVariants,
                },
            })

            if (hasVariants) {
                // Delete missing variants (careful with existing sales, but user wants ability to manage this)
                // For safety, we only delete variants that are NOT in the new list AND not used?
                // For this MVP, we will try to sync.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const newVariantIds = parsedVariants.map((v: any) => v.id).filter(Boolean)

                await tx.productVariant.deleteMany({
                    where: {
                        productId: id,
                        id: { notIn: newVariantIds }
                    }
                })

                // Upsert variants
                for (const v of parsedVariants) {
                    if (v.id) {
                        await tx.productVariant.update({
                            where: { id: v.id },
                            data: {
                                name: v.name,
                                price: v.price,
                                stock: v.stock,
                                sku: v.sku
                            }
                        })
                    } else {
                        await tx.productVariant.create({
                            data: {
                                productId: id,
                                name: v.name,
                                price: v.price,
                                stock: v.stock,
                                sku: v.sku
                            }
                        })
                    }
                }
            } else {
                // If no variants in form, maybe user deleted all? 
                // If hasVariants was true, we should clear?
                // Let's rely on the flag.
                // If switching from Variants to No Variants, we might want to keep or delete.
                // For now, if variants array is empty, we assume no action or delete all? 
                // Implementing: If empty array passed but productHAD variants, we delete all.
                await tx.productVariant.deleteMany({ where: { productId: id } })
            }
        })

        revalidatePath("/products")
        return { message: "Producto actualizado correctamente" }
    } catch (e) {
        console.error(e)
        return { message: "Error al actualizar producto" }
    }
}

export async function deleteProduct(id: string) {
    // Check for usage in Invoices or Quotes
    const usageCount = await prisma.invoiceItem.count({ where: { productId: id } })
    const quoteCount = await prisma.quoteItem.count({ where: { productId: id } })

    if (usageCount > 0 || quoteCount > 0) {
        return { success: false, error: "No se puede eliminar el producto porque tiene ventas o cotizaciones asociadas." }
    }

    try {
        await prisma.product.delete({ where: { id } })
        revalidatePath("/products")
        return { success: true }
    } catch {
        return { success: false, error: "Error al eliminar producto" }
    }
}
