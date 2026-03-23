"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { Database } from "@/lib/supabase/database.types"

type Dispatch = Database['public']['Tables']['Dispatch']['Row']
type DispatchUpdate = Database['public']['Tables']['Dispatch']['Update']
type DispatchPhoto = Database['public']['Tables']['DispatchPhoto']['Row']
type InvoiceItem = Database['public']['Tables']['InvoiceItem']['Row']

export async function getTechnicianDispatches(technicianId: string) {
    const supabase = await createClient()

    const { data: dispatches, error } = await supabase
        .from('Dispatch')
        .select(`
            *,
            invoice:Invoice(
                *,
                client:Client(*),
                items:InvoiceItem(*)
            )
        `)
        .in('status', ['PENDING', 'ASSIGNED', 'IN_PROGRESS'])
        .eq('technicianId', technicianId)
        .order('createdAt', { ascending: true })

    if (error) {
        console.error(error)
        return []
    }

    return (dispatches || []).map(dispatch => ({
        ...dispatch,
        invoice: dispatch.invoice ? {
            ...dispatch.invoice,
            total: Number(dispatch.invoice.total),
            items: (dispatch.invoice.items || []).map((item: InvoiceItem) => ({
                ...item,
                price: Number(item.price)
            }))
        } : null
    }))
}

export async function updateDispatchStatus(
    dispatchId: string,
    status: string,
    notes?: string,
    photos?: string[]
) {
    const supabase = await createClient()

    const updateData: DispatchUpdate = {
        status
    }

    if (notes) {
        updateData.notes = notes
    }

    if (status === 'DELIVERED') {
        updateData.deliveredAt = new Date().toISOString()
    }

    if (status === 'INSTALLED') {
        updateData.installedAt = new Date().toISOString()
    }

    const { data: dispatch, error } = await supabase
        .from('Dispatch')
        .update(updateData)
        .eq('id', dispatchId)
        .select()
        .single()

    if (error || !dispatch) {
        throw error || new Error("Failed to update dispatch")
    }

    // If there are photos, save them
    if (photos && photos.length > 0) {
        const photosData = photos.map(photoUrl => ({
            dispatchId,
            photoUrl,
            takenBy: dispatch.technicianId || undefined
        }))

        await supabase
            .from('DispatchPhoto')
            .insert(photosData)
    }

    revalidatePath('/technician')
    revalidatePath('/dispatch')

    return dispatch
}

export async function getDispatchById(dispatchId: string) {
    const supabase = await createClient()

    const { data: dispatch, error } = await supabase
        .from('Dispatch')
        .select(`
            *,
            invoice:Invoice(
                *,
                client:Client(*),
                items:InvoiceItem(*)
            ),
            photos:DispatchPhoto(*),
            technician:User(*)
        `)
        .eq('id', dispatchId)
        .single()

    if (error || !dispatch) {
        return null
    }

    return {
        ...dispatch,
        invoice: dispatch.invoice ? {
            ...dispatch.invoice,
            total: Number(dispatch.invoice.total),
            items: (dispatch.invoice.items || []).map((item: InvoiceItem) => ({
                ...item,
                price: Number(item.price)
            }))
        } : null
    }
}
