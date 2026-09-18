"use server"


import { requireAuth } from "@/actions/auth-actions";
import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { addClientHistoryEntry } from "./client-history-actions"



const ClientSchema = z.object({
    name: z.string().min(1, "Name is required"),
    rnc: z.string().optional(),
    cedula: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
})

export async function createClientAction(prevState: unknown, formData: FormData) {
    await requireAuth();

    const name = String(formData.get("name") || "").trim()
    const rnc = String(formData.get("rnc") || "").trim() || null
    const cedula = String(formData.get("cedula") || "").trim() || null
    const address = String(formData.get("address") || "").trim() || null
    const phone = String(formData.get("phone") || "").trim() || null
    const rawEmail = String(formData.get("email") || "").trim()
    const email = rawEmail ? rawEmail : null

    const validatedFields = ClientSchema.safeParse({
        name,
        rnc: rnc || undefined,
        cedula: cedula || undefined,
        address: address || undefined,
        phone: phone || undefined,
        email: email || "",
    })

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        }
    }

    const insforge = createServerClient()

    try {
        // 1. Prevent duplicates by RNC if provided
        if (rnc) {
            const { data: existingRnc } = await insforge.database
                .from('Client')
                .select('id, name')
                .eq('rnc', rnc)
                .limit(1)

            if (existingRnc && existingRnc.length > 0) {
                return { message: `Ya existe un cliente con este RNC (${existingRnc[0].name})`, success: false }
            }
        }

        // 2. Prevent duplicates by Cédula if provided
        if (cedula) {
            const { data: existingCedula } = await insforge.database
                .from('Client')
                .select('id, name')
                .eq('cedula', cedula)
                .limit(1)

            if (existingCedula && existingCedula.length > 0) {
                return { message: `Ya existe un cliente con esta Cédula (${existingCedula[0].name})`, success: false }
            }
        }

        // 3. Debounce rapid identical submissions (within last 15 seconds) to avoid double-clicks
        const recentThreshold = new Date(Date.now() - 15 * 1000).toISOString()
        const { data: recentDuplicates } = await insforge.database
            .from('Client')
            .select('id, name, createdAt')
            .ilike('name', name)
            .gte('createdAt', recentThreshold)
            .limit(1)

        if (recentDuplicates && recentDuplicates.length > 0) {
            return { message: "Client created successfully", success: true, client: recentDuplicates[0] }
        }

        const clientData = {
            name,
            rnc,
            cedula,
            address,
            phone,
            email: email || null
        }

        const { data: client, error } = await insforge.database
            .from('Client')
            .insert([clientData])
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
            clientData
        )

        revalidatePath("/clients")
        return { message: "Client created successfully", success: true, client }
    } catch (error) {
        console.error("Error creating client:", error)
        return { message: "Failed to create client", success: false }
    }
}

export async function updateClient(id: string, prevState: unknown, formData: FormData) {
    await requireAuth();

    const name = String(formData.get("name") || "").trim()
    const rnc = String(formData.get("rnc") || "").trim() || null
    const cedula = String(formData.get("cedula") || "").trim() || null
    const address = String(formData.get("address") || "").trim() || null
    const phone = String(formData.get("phone") || "").trim() || null
    const rawEmail = String(formData.get("email") || "").trim()
    const email = rawEmail ? rawEmail : null

    const validatedFields = ClientSchema.safeParse({
        name,
        rnc: rnc || undefined,
        cedula: cedula || undefined,
        address: address || undefined,
        phone: phone || undefined,
        email: email || "",
    })

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        }
    }

    const insforge = createServerClient()

    try {
        if (rnc) {
            const { data: existingRnc } = await insforge.database
                .from('Client')
                .select('id, name')
                .eq('rnc', rnc)
                .neq('id', id)
                .limit(1)

            if (existingRnc && existingRnc.length > 0) {
                return { message: `Ya existe otro cliente con este RNC (${existingRnc[0].name})`, success: false }
            }
        }

        if (cedula) {
            const { data: existingCedula } = await insforge.database
                .from('Client')
                .select('id, name')
                .eq('cedula', cedula)
                .neq('id', id)
                .limit(1)

            if (existingCedula && existingCedula.length > 0) {
                return { message: `Ya existe otro cliente con esta Cédula (${existingCedula[0].name})`, success: false }
            }
        }

        const clientData = {
            name,
            rnc,
            cedula,
            address,
            phone,
            email: email || null
        }

        const { data: client, error } = await insforge.database
            .from('Client')
            .update(clientData)
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
            { changes: clientData }
        )

        revalidatePath("/clients")
        return { message: "Client updated successfully", success: true }
    } catch (error) {
        console.error("Error updating client:", error)
        return { message: "Failed to update client", success: false }
    }
}

export async function deleteClient(id: string) {
    await requireAuth();

    const insforge = createServerClient()

    try {
        const { data: client } = await insforge.database
            .from('Client')
            .select('*')
            .eq('id', id)
            .single()

        if (!client) {
            return { success: false, error: "Cliente no encontrado" }
        }

        // Check for related invoices
        const { count: invoiceCount } = await insforge.database
            .from('Invoice')
            .select('*', { count: 'exact', head: true })
            .eq('clientId', id)

        const { count: quoteCount } = await insforge.database
            .from('Quote')
            .select('*', { count: 'exact', head: true })
            .eq('clientId', id)

        if ((invoiceCount || 0) > 0 || (quoteCount || 0) > 0) {
            return {
                success: false,
                error: `No se puede eliminar. El cliente tiene registros asociados.`
            }
        }

        const { error } = await insforge.database
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
    await requireAuth();

    const insforge = createServerClient()

    const { data, error } = await insforge.database
        .from('Client')
        .select('*')
        .order('createdAt', { ascending: false })

    if (error) {
        console.error(error)
        return []
    }

    return data || []
}
