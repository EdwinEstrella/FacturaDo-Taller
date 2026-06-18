"use server"


import { requireAuth } from "@/actions/auth-actions";
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

type InstallationRow = Record<string, unknown>

function mapInstallationFromDb(row: InstallationRow) {
    return {
        id: String(row.id),
        invoiceId: row.invoiceid as string | null,
        productId: row.productid as string | null,
        productName: String(row.productname || ""),
        quantity: Number(row.quantity || 0),
        clientName: String(row.clientname || ""),
        clientAddress: row.clientaddress as string | null,
        clientPhone: row.clientphone as string | null,
        estado: String(row.estado || "Pendiente"),
        tecnicoAsignado: row.tecnicoasignado as string | null,
        fechaCreacion: String(row.fechacreacion || new Date().toISOString()),
        fechaEnProduccion: row.fechaenproduccion as string | null,
        fechaListaDespacho: row.fechalistadespacho as string | null,
        fechaPendienteInstalacion: row.fechapendienteinstalacion as string | null,
        fechaInstalada: row.fechainstalada as string | null,
        instaladoPor: row.instaladopor as string | null,
        fotos: row.fotos as string | null,
        notas: row.notas as string | null,
        createdById: row.createdbyid as string | null,
        windowBreakdownId: row.windowbreakdownid as string | null,
    }
}

export async function createInstallationsForInvoice(items: InstallationItem[]) {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const insforge = createServerClient()

    try {
        const installations = items.map(item => ({
            id: crypto.randomUUID(),
            invoiceid: item.invoiceId,
            productid: item.productId,
            productname: item.productName,
            quantity: item.quantity,
            clientname: item.clientName,
            clientaddress: item.clientAddress || null,
            clientphone: item.clientPhone || null,
            estado: 'Pendiente',
            createdbyid: user.id
        }))

        const { error } = await insforge.database
            .from('installations')
            .insert(installations)

        if (error) throw error

        revalidatePath('/pendientes')
        return { success: true, count: installations.length }
    } catch {
        return { success: false, error: "Error al crear instalaciones" }
    }
}

export async function getInstallations(filters?: {
    await requireAuth();

    estado?: string
    tecnicoAsignado?: string
    clientId?: string
}) {
    const insforge = createServerClient()

    try {
        let query = insforge.database
            .from('installations')
            .select('*')
            .order('fechacreacion', { ascending: false })

        if (filters?.estado) {
            query = query.eq('estado', filters.estado)
        }

        if (filters?.tecnicoAsignado) {
            query = query.eq('tecnicoasignado', filters.tecnicoAsignado)
        }

        const { data, error } = await query

        if (error) {
            // Si la tabla no existe o hay un error, retornar array vacío silenciosamente
            return []
        }

        return (data || []).map((row) => mapInstallationFromDb(row))
    } catch {
        // Silenciar errores de conexión o tablas faltantes
        return []
    }
}

export async function getPendingInstallationsCount() {
    await requireAuth();

    const insforge = createServerClient()

    try {
        const { data, error } = await insforge.database
            .from('installations')
            .select('id', { count: 'exact', head: false })
            .in('estado', ['Pendiente', 'EnProduccion', 'ListaDespacho', 'PendienteInstalacion'])

        if (error) {
            // Si la tabla no existe o hay un error, retornar 0 silenciosamente
            return 0
        }

        return data?.length || 0
    } catch {
        // Silenciar errores de conexión o tablas faltantes
        return 0
    }
}

export async function updateInstallationState(
    installationId: string,
    newState: string,
    userId?: string
) {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const insforge = createServerClient()

    try {
        const updates: Record<string, string | number> = { estado: newState }
        const timestamp = new Date().toISOString()

        // Add timestamp based on state
        switch (newState) {
            case 'EnProduccion':
                updates.fechaenproduccion = timestamp
                if (userId) updates.tecnicoasignado = userId
                break
            case 'ListaDespacho':
                updates.fechalistadespacho = timestamp
                break
            case 'PendienteInstalacion':
                updates.fechapendienteinstalacion = timestamp
                break
            case 'Instalada':
                updates.fechainstalada = timestamp
                if (userId) updates.instaladopor = userId
                break
        }

        const { error } = await insforge.database
            .from('installations')
            .update(updates)
            .eq('id', installationId)

        if (error) throw error

        revalidatePath('/pendientes')
        return { success: true }
    } catch {
        return { success: false, error: "Error al actualizar estado" }
    }
}

export async function updateInstallationPhotos(installationId: string, fotos: string[]) {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    if (fotos.length > 5) {
        return { success: false, error: "Máximo 5 fotos permitidas" }
    }

    const insforge = createServerClient()

    try {
        const { error } = await insforge.database
            .from('installations')
            .update({ fotos: JSON.stringify(fotos) })
            .eq('id', installationId)

        if (error) throw error

        revalidatePath('/pendientes')
        return { success: true }
    } catch {
        return { success: false, error: "Error al actualizar fotos" }
    }
}

export async function getInstallationById(installationId: string) {
    await requireAuth();

    const insforge = createServerClient()

    try {
        const { data, error } = await insforge.database
            .from('installations')
            .select('*')
            .eq('id', installationId)
            .single()

        if (error) {
            return null
        }

        return mapInstallationFromDb(data)
    } catch {
        return null
    }
}

export async function assignTechnician(installationId: string, tecnicoId: string) {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
        return { success: false, error: "No autorizado" }
    }

    const insforge = createServerClient()

    try {
        const { error } = await insforge.database
            .from('installations')
            .update({ tecnicoasignado: tecnicoId })
            .eq('id', installationId)

        if (error) throw error

        revalidatePath('/pendientes')
        return { success: true }
    } catch {
        return { success: false, error: "Error al asignar técnico" }
    }
}
