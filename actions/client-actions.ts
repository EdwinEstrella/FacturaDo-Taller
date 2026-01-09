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
        return { message: "Client created successfully" }
    } catch (e) {
        return { message: "Failed to create client" }
    }
}

export async function getClients() {
    return await prisma.client.findMany({
        orderBy: { createdAt: 'desc' }
    })
}
