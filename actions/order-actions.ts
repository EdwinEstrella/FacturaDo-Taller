"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { Database } from "@/lib/supabase/database.types"

type InvoiceItem = Database['public']['Tables']['InvoiceItem']['Row']

export async function createWorkOrder(invoiceId: string, notes: string) {
    const supabase = await createClient()

    try {
        const { data: order, error } = await supabase
            .from('WorkOrder')
            .insert({
                invoiceId,
                notes,
                status: "PRODUCTION"
            })
            .select()
            .single()

        if (error || !order) {
            throw error
        }

        revalidatePath("/orders")
        revalidatePath("/invoices")
        return { success: true, orderId: order.id }
    } catch (e) {
        console.error(e)
        return { success: false, error: "Error al crear orden de trabajo" }
    }
}

export async function updateWorkOrderStatus(id: number, status: string) {
    const supabase = await createClient()

    try {
        const { error } = await supabase
            .from('WorkOrder')
            .update({ status })
            .eq('id', id)

        if (error) {
            throw error
        }

        revalidatePath("/orders")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Error al actualizar estado" }
    }
}

export async function getWorkOrders() {
    const supabase = await createClient()

    const { data: workOrders, error } = await supabase
        .from('WorkOrder')
        .select(`
            *,
            invoice:Invoice(
                *,
                items:InvoiceItem(*),
                client:Client(*)
            )
        `)
        .order('createdAt', { ascending: false })

    if (error) {
        console.error(error)
        return []
    }

    return (workOrders || []).map(order => ({
        ...order,
        invoice: order.invoice ? {
            ...order.invoice,
            total: Number(order.invoice.total),
            items: (order.invoice.items || []).map((item: InvoiceItem) => ({
                ...item,
                price: Number(item.price)
            }))
        } : null
    }))
}
