"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const ClientSchema = z.object({
    name: z.string().min(1, "Name is required"),
    rnc: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createClient(prevState: any, formData: FormData) {
    const validatedFields = ClientSchema.safeParse({
        name: formData.get("name"),
        rnc: formData.get("rnc"),
        address: formData.get("address"),
        phone: formData.get("phone"),
        email: formData.get("email"),
    })

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        }
    }

    try {
        await prisma.client.create({
            data: validatedFields.data,
        })
        revalidatePath("/clients")
        return { message: "Client created successfully", success: true }
    } catch (e) {
        return { message: "Failed to create client", success: false }
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateClient(id: string, prevState: any, formData: FormData) {
    const validatedFields = ClientSchema.safeParse({
        name: formData.get("name"),
        rnc: formData.get("rnc"),
        address: formData.get("address"),
        phone: formData.get("phone"),
        email: formData.get("email"),
    })

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        }
    }

    try {
        await prisma.client.update({
            where: { id },
            data: validatedFields.data,
        })
        revalidatePath("/clients")
        return { message: "Client updated successfully", success: true }
    } catch (e) {
        return { message: "Failed to update client", success: false }
    }
}

export async function deleteClient(id: string) {
    try {
        const client = await prisma.client.findUnique({
            where: { id },
            include: { invoices: { select: { id: true } }, quotes: { select: { id: true } } }
        })

        if (!client) return { success: false, error: "Cliente no encontrado" }

        if (client.invoices.length > 0 || client.quotes.length > 0) {
            return {
                success: false,
                error: `No se puede eliminar. El cliente tiene ${client.invoices.length} facturas y ${client.quotes.length} cotizaciones asociadas.`
            }
        }

        await prisma.client.delete({ where: { id } })
        revalidatePath("/clients")
        return { success: true }
    } catch (e) {
        console.error(e)
        return { success: false, error: "Error al eliminar cliente" }
    }
}

export async function getClients() {
    return await prisma.client.findMany({
        orderBy: { createdAt: 'desc' }
    })
}
