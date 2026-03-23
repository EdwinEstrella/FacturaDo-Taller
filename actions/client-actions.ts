"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { addClientHistoryEntry } from "./client-history-actions"
import { Database } from "@/lib/supabase/database.types"

type Client = Database['public']['Tables']['Client']['Row']
type ClientInsert = Database['public']['Tables']['Client']['Insert']
type ClientUpdate = Database['public']['Tables']['Client']['Update']

const ClientSchema = z.object({
    name: z.string().min(1, "Name is required"),
    rnc: z.string().optional(),
    cedula: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
})

export async function createClientAction(prevState: any, formData: FormData) {
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

    const supabase = await createClient()

    try {
        const { data: client, error } = await supabase
            .from('Client')
            .insert(validatedFields.data)
            .select()
            .single()

        if (error || !client) {
            throw error
        }

        // Add to history
        await addClientHistoryEntry(
            client.id,
            "CREATED",
            `Cliente creado: ${client.name}`,
            { ...validatedFields.data }
        )

        revalidatePath("/clients")
        return { message: "Client created successfully", success: true }
    } catch (error) {
        console.error(error)
        return { message: "Failed to create client", success: false }
    }
}

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

    const supabase = await createClient()

    try {
        const { data: client, error } = await supabase
            .from('Client')
            .update(validatedFields.data)
            .eq('id', id)
            .select()
            .single()

        if (error || !client) {
            throw error
        }

        // Add to history
        await addClientHistoryEntry(
            client.id,
            "UPDATED",
            `Cliente actualizado: ${client.name}`,
            { changes: validatedFields.data }
        )

        revalidatePath("/clients")
        return { message: "Client updated successfully", success: true }
    } catch (error) {
        console.error(error)
        return { message: "Failed to update client", success: false }
    }
}

export async function deleteClient(id: string) {
    const supabase = await createClient()

    try {
        const { data: client } = await supabase
            .from('Client')
            .select('*')
            .eq('id', id)
            .single()

        if (!client) {
            return { success: false, error: "Cliente no encontrado" }
        }

        // Check for related invoices
        const { count: invoiceCount } = await supabase
            .from('Invoice')
            .select('*', { count: 'exact', head: true })
            .eq('clientId', id)

        const { count: quoteCount } = await supabase
            .from('Quote')
            .select('*', { count: 'exact', head: true })
            .eq('clientId', id)

        if ((invoiceCount || 0) > 0 || (quoteCount || 0) > 0) {
            return {
                success: false,
                error: `No se puede eliminar. El cliente tiene registros asociados.`
            }
        }

        const { error } = await supabase
            .from('Client')
            .delete()
            .eq('id', id)

        if (error) {
            throw error
        }

        revalidatePath("/clients")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Error al eliminar cliente" }
    }
}

export async function getClients() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('Client')
        .select('*')
        .order('createdAt', { ascending: false })

    if (error) {
        console.error(error)
        return []
    }

    return data || []
}
