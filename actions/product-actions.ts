"use server"

import { createServerClient } from "@/lib/insforge/client"
import type { ProductUpdate, ProductVariant } from "@/types"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "@/actions/auth-actions"



const ProductSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    price: z.coerce.number().min(0),
    cost: z.coerce.number().min(0).optional(),
    stock: z.coerce.number().int().min(0),
    minStock: z.coerce.number().int().min(0).optional(),
    sku: z.string().optional(),
    variants: z.string().optional(),
    category: z.enum(["MATERIAL", "ARTICULO", "SERVICIO"]),
    unitType: z.enum(["UNIT", "MEASURE"]).default("UNIT"),
})

export async function createProduct(prevState: unknown, formData: FormData) {
    const user = await getCurrentUser()
    if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
        return { error: "No tienes permisos para crear productos" }
    }

    const validatedFields = ProductSchema.safeParse({
        name: formData.get("name"),
        description: formData.get("description"),
        price: formData.get("price"),
        cost: formData.get("cost"),
        stock: formData.get("stock"),
        minStock: formData.get("minStock"),
        sku: formData.get("sku"),
        category: formData.get("category"),
        unitType: formData.get("unitType"),
        variants: formData.get("variants"),
    })

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        }
    }

    const insforge = createServerClient()

    try {
        const { category, variants, unitType, ...rest } = validatedFields.data
        const parsedVariants = variants ? JSON.parse(variants) : []
        const hasVariants = parsedVariants.length > 0

        const totalStock = hasVariants
            ? parsedVariants.reduce((acc: number, v: Record<string, unknown>) => acc + (Number(v.stock) || 0), 0)
            : rest.stock

        const productData = {
            ...rest,
            stock: totalStock,
            category,
            unitType,
            isService: category === "SERVICIO",
            hasVariants,
        }

        const { data: product, error: productError } = await insforge.database
            .from('Product')
            .insert(productData)
            .select()
            .single()

        if (productError || !product) {
            throw new Error(productError?.message || "Failed to create product")
        }

        // Create variants
        if (hasVariants) {
            const variantData = parsedVariants.map((v: Record<string, unknown>) => ({
                productId: product.id,
                name: v.name,
                price: v.price,
                cost: v.cost || 0,
                stock: v.stock,
                sku: v.sku
            }))

            const { error: variantsError } = await insforge.database
                .from('ProductVariant')
                .insert(variantData)

            if (variantsError) {
                throw new Error(variantsError.message)
            }
        }

        revalidatePath("/products")
        return { message: "Producto creado correctamente" }
    } catch (e) {
        console.error(e)
        return { message: "Failed to create product" }
    }
}

export async function getProducts() {
    const insforge = createServerClient()

    const { data: products, error } = await insforge.database
        .from('Product')
        .select('*')
        .order('name', { ascending: true })

    if (error) {
        console.error(error)
        return []
    }

    // Get variants separately for each product
    const productIds = products?.map(p => p.id) || []
    const { data: variants } = productIds.length > 0
        ? await insforge.database
            .from('ProductVariant')
            .select('*')
            .in('productId', productIds)
        : { data: [] }

    return products.map(product => ({
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : 0,
        variants: (variants || [])
            .filter((v: ProductVariant) => v.productId === product.id)
            .map((variant: ProductVariant) => ({
                ...variant,
                price: Number(variant.price),
                cost: variant.cost ? Number(variant.cost) : 0
            }))
    }))
}

export async function updateProduct(id: string, prevState: unknown, formData: FormData) {
    const user = await getCurrentUser()
    if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
        return { error: "No tienes permisos para editar productos" }
    }

    const validatedFields = ProductSchema.safeParse({
        name: formData.get("name"),
        description: formData.get("description"),
        price: formData.get("price"),
        cost: formData.get("cost"),
        stock: formData.get("stock"),
        minStock: formData.get("minStock"),
        sku: formData.get("sku"),
        category: formData.get("category"),
        unitType: formData.get("unitType"),
        variants: formData.get("variants"),
    })

    if (!validatedFields.success) {
        return { errors: validatedFields.error.flatten().fieldErrors }
    }

    const insforge = createServerClient()

    try {
        const { category, variants, unitType, ...rest } = validatedFields.data
        const parsedVariants = variants ? JSON.parse(variants) : []
        const hasVariants = parsedVariants.length > 0

        const totalStock = hasVariants
            ? parsedVariants.reduce((acc: number, v: Record<string, unknown>) => acc + (Number(v.stock) || 0), 0)
            : rest.stock

        const updateData: ProductUpdate = {
            ...rest,
            stock: totalStock,
            category,
            unitType,
            isService: category === "SERVICIO",
            hasVariants,
        }

        // Update main product
        const { error: updateError } = await insforge.database
            .from('Product')
            .update(updateData)
            .eq('id', id)

        if (updateError) {
            throw new Error(updateError.message)
        }

        if (hasVariants) {
            // Get existing variants
            const { data: existingVariants } = await insforge.database
                .from('ProductVariant')
                .select('id')
                .eq('productId', id)

            const newVariantIds = parsedVariants
                .map((v: Record<string, unknown>) => v.id)
                .filter(Boolean)

            const existingVariantIds = existingVariants?.map(v => v.id) || []

            // Delete variants that are not in the new list
            const variantsToDelete = existingVariantIds.filter(id => !newVariantIds.includes(id))
            if (variantsToDelete.length > 0) {
                await insforge.database
                    .from('ProductVariant')
                    .delete()
                    .in('id', variantsToDelete)
            }

            // Upsert variants
            for (const v of parsedVariants) {
                if (v.id) {
                    await insforge.database
                        .from('ProductVariant')
                        .update({
                            name: v.name,
                            price: v.price,
                            cost: v.cost || 0,
                            stock: v.stock,
                            sku: v.sku
                        })
                        .eq('id', v.id)
                } else {
                    await insforge.database
                        .from('ProductVariant')
                        .insert([{
                            productId: id,
                            name: v.name,
                            price: v.price,
                            cost: v.cost || 0,
                            stock: v.stock,
                            sku: v.sku
                        }])
                }
            }
        } else {
            // Delete all variants if no variants in form
            await insforge.database
                .from('ProductVariant')
                .delete()
                .eq('productId', id)
        }

        revalidatePath("/products")
        return { message: "Producto actualizado correctamente" }
    } catch (e) {
        console.error(e)
        return { message: "Error al actualizar producto" }
    }
}

export async function deleteProduct(id: string) {
    const user = await getCurrentUser()
    if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
        return { success: false, error: "No tienes permisos para eliminar productos" }
    }

    const insforge = createServerClient()

    // Check for usage in Invoices or Quotes
    const { count: invoiceCount } = await insforge.database
        .from('InvoiceItem')
        .select('*', { count: 'exact', head: true })
        .eq('productId', id)

    const { count: quoteCount } = await insforge.database
        .from('QuoteItem')
        .select('*', { count: 'exact', head: true })
        .eq('productId', id)

    if ((invoiceCount || 0) > 0 || (quoteCount || 0) > 0) {
        return { success: false, error: "No se puede eliminar el producto porque tiene ventas o cotizaciones asociadas." }
    }

    try {
        // Delete variants first
        await insforge.database
            .from('ProductVariant')
            .delete()
            .eq('productId', id)

        // Delete product
        const { error } = await insforge.database
            .from('Product')
            .delete()
            .eq('id', id)

        if (error) {
            throw error
        }

        revalidatePath("/products")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Error al eliminar producto" }
    }
}

export async function quickCreateProduct(data: { name: string, price: number, sku?: string, category?: "ARTICULO" | "MATERIAL" | "SERVICIO" }) {
    const user = await getCurrentUser()
    if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER" && user.role !== "ACCOUNTANT")) {
        return { success: false, error: "No tienes permisos para crear productos" }
    }

    const insforge = createServerClient()

    try {
        const productData = {
            name: data.name,
            price: data.price,
            sku: data.sku,
            category: data.category || "ARTICULO",
            stock: 0,
            cost: 0,
            isService: data.category === "SERVICIO",
            hasVariants: false,
            unitType: "UNIT",
            minStock: 0,
        }

        const { data: product, error } = await insforge.database
            .from('Product')
            .insert(productData)
            .select()
            .single()

        if (error || !product) {
            throw error
        }

        revalidatePath("/products")
        return {
            success: true,
            product: {
                ...product,
                price: Number(product.price),
                cost: product.cost ? Number(product.cost) : 0
            }
        }
    } catch (e) {
        console.error("Quick Create Product Error:", e)
        return { success: false, error: "Error al crear producto" }
    }
}
