"use server"

import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"

export interface InstallationItem {
    invoiceId: string
    productId: string
    productName: string
    quantity: number
    clientName: string
    clientAddress?: string | null
    clientPhone?: string | null
}

export async function createInstallationsForInvoice(items: InstallationItem[]) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const insforge = createServerClient()

    try {
        const installations = items.map(item => ({
            id: crypto.randomUUID(),
            invoiceId: item.invoiceId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            clientName: item.clientName,
            clientAddress: item.clientAddress || null,
            clientPhone: item.clientPhone || null,
            estado: 'Pendiente',
            createdById: user.id
        }))

        const { error } = await insforge.database
            .from('Installations')
            .insert(installations)

        if (error) throw error

        revalidatePath('/pendientes')
        return { success: true, count: installations.length }
    } catch (error) {
        return { success: false, error: "Error al crear instalaciones" }
    }
}

export async function getInstallations(filters?: {
    estado?: string
    tecnicoAsignado?: string
    clientId?: string
}) {
    const insforge = createServerClient()

    try {
        let query = insforge.database
            .from('Installations')
            .select('*')
            .order('fechaCreacion', { ascending: false })

        if (filters?.estado) {
            query = query.eq('estado', filters.estado)
        }

        if (filters?.tecnicoAsignado) {
            query = query.eq('tecnicoAsignado', filters.tecnicoAsignado)
        }

        const { data, error } = await query

        if (error) {
            // Si la tabla no existe o hay un error, retornar array vacío silenciosamente
            return []
        }

        return data || []
    } catch (error) {
        // Silenciar errores de conexión o tablas faltantes
        return []
    }
}

export async function getPendingInstallationsCount() {
    const insforge = createServerClient()

    try {
        const { data, error } = await insforge.database
            .from('Installations')
            .select('id', { count: 'exact', head: false })
            .in('estado', ['Pendiente', 'EnProduccion', 'ListaDespacho', 'PendienteInstalacion'])

        if (error) {
            // Si la tabla no existe o hay un error, retornar 0 silenciosamente
            return 0
        }

        return data?.length || 0
    } catch (error) {
        // Silenciar errores de conexión o tablas faltantes
        return 0
    }
}

export async function updateInstallationState(
    installationId: string,
    newState: string,
    userId?: string
) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const insforge = createServerClient()

    try {
        const updates: Record<string, string | number> = { estado: newState }
        const timestamp = new Date().toISOString()

        // Add timestamp based on state
        switch (newState) {
            case 'EnProduccion':
                updates.fechaEnProduccion = timestamp
                if (userId) updates.tecnicoAsignado = userId
                break
            case 'ListaDespacho':
                updates.fechaListaDespacho = timestamp
                break
            case 'PendienteInstalacion':
                updates.fechaPendienteInstalacion = timestamp
                break
            case 'Instalada':
                updates.fechaInstalada = timestamp
                if (userId) updates.instaladoPor = userId
                break
        }

        const { error } = await insforge.database
            .from('Installations')
            .update(updates)
            .eq('id', installationId)

        if (error) throw error

        revalidatePath('/pendientes')
        return { success: true }
    } catch (error) {
        return { success: false, error: "Error al actualizar estado" }
    }
}

export async function updateInstallationPhotos(installationId: string, fotos: string[]) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    if (fotos.length > 5) {
        return { success: false, error: "Máximo 5 fotos permitidas" }
    }

    const insforge = createServerClient()

    try {
        const { error } = await insforge.database
            .from('Installations')
            .update({ fotos: JSON.stringify(fotos) })
            .eq('id', installationId)

        if (error) throw error

        revalidatePath('/pendientes')
        return { success: true }
    } catch (error) {
        return { success: false, error: "Error al actualizar fotos" }
    }
}

export async function getInstallationById(installationId: string) {
    const insforge = createServerClient()

    try {
        const { data, error } = await insforge.database
            .from('Installations')
            .select('*')
            .eq('id', installationId)
            .single()

        if (error) {
            return null
        }

        return data
    } catch (error) {
        return null
    }
}

export async function assignTechnician(installationId: string, tecnicoId: string) {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
        return { success: false, error: "No autorizado" }
    }

    const insforge = createServerClient()

    try {
        const { error } = await insforge.database
            .from('Installations')
            .update({ tecnicoAsignado: tecnicoId })
            .eq('id', installationId)

        if (error) throw error

        revalidatePath('/pendientes')
        return { success: true }
    } catch (error) {
        return { success: false, error: "Error al asignar técnico" }
    }
}
