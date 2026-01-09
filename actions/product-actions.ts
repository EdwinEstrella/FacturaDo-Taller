"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const ProductSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    price: z.coerce.number().min(0),
    stock: z.coerce.number().int().min(0),
    minStock: z.coerce.number().int().min(0).optional(),
    sku: z.string().optional(),
    // isService: z.boolean().optional(), // Removed from input, derived from category
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
    })

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        }
    }

    try {
        const { category, ...rest } = validatedFields.data
        await prisma.product.create({
            data: {
                ...rest,
                category,
                isService: category === "SERVICIO", // Auto-set based on category
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
    })

    if (!validatedFields.success) {
        return { errors: validatedFields.error.flatten().fieldErrors }
    }

    try {
        const { category, ...rest } = validatedFields.data
        await prisma.product.update({
            where: { id },
            data: {
                ...rest,
                category,
                isService: category === "SERVICIO",
            },
        })
        revalidatePath("/products")
        return { message: "Producto actualizado correctamente" }
    } catch (e) {
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
    } catch (e) {
        return { success: false, error: "Error al eliminar producto" }
    }
}
