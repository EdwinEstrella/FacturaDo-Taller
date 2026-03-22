"use server"

import { db } from "@/lib/db"
import { clients, invoices, quotes } from "@/db/schema"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { addClientHistoryEntry } from "./client-history-actions"
import { eq, desc } from "drizzle-orm"

const ClientSchema = z.object({
    name: z.string().min(1, "Name is required"),
    rnc: z.string().optional(),
    cedula: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createClient(prevState: any, formData: FormData) {
    const validatedFields = ClientSchema.safeParse({
        name: formData.get("name"),
        rnc: formData.get("rnc"),
        cedula: formData.get("cedula"),
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
        const [client] = await db.insert(clients).values(validatedFields.data).returning()

        // Agregar al historial
        await addClientHistoryEntry(
            client.id,
            "CREATED",
            `Cliente creado: ${client.name}`,
            { ...validatedFields.data }
        )

        revalidatePath("/clients")
        return { message: "Client created successfully", success: true }
    } catch {
        return { message: "Failed to create client", success: false }
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateClient(id: string, prevState: any, formData: FormData) {
    const validatedFields = ClientSchema.safeParse({
        name: formData.get("name"),
        rnc: formData.get("rnc"),
        cedula: formData.get("cedula"),
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
        const [client] = await db.update(clients)
            .set(validatedFields.data)
            .where(eq(clients.id, id))
            .returning()

        // Agregar al historial
        await addClientHistoryEntry(
            client.id,
            "UPDATED",
            `Cliente actualizado: ${client.name}`,
            { changes: validatedFields.data }
        )

        revalidatePath("/clients")
        return { message: "Client updated successfully", success: true }
    } catch {
        return { message: "Failed to update client", success: false }
    }
}

export async function deleteClient(id: string) {
    try {
        const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1)

        if (!client) return { success: false, error: "Cliente no encontrado" }

        // Check for related invoices
        const [invoiceCount] = await db.select({ count: invoices.id }).from(invoices).where(eq(invoices.clientId, id))
        const [quoteCount] = await db.select({ count: quotes.id }).from(quotes).where(eq(quotes.clientId, id))

        if (invoiceCount || quoteCount) {
            return {
                success: false,
                error: `No se puede eliminar. El cliente tiene registros asociados.`
            }
        }

        await db.delete(clients).where(eq(clients.id, id))
        revalidatePath("/clients")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Error al eliminar cliente" }
    }
}

export async function getClients() {
    return await db.select().from(clients).orderBy(desc(clients.createdAt))
}
