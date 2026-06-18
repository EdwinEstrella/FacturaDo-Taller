"use server"


import { requireAuth } from "@/actions/auth-actions";
import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"

export async function createWorkOrder(invoiceId: string, notes: string) {
    await requireAuth();

    const insforge = createServerClient()

    try {
        const { data: order, error } = await insforge.database
            .from('WorkOrder')
            .insert([{
                invoiceId,
                notes,
                status: "PRODUCTION"
            }])
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

export async function updateWorkOrderStatus(id: string, status: string) {
    await requireAuth();

    const insforge = createServerClient()

    try {
        const { error } = await insforge.database
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
    await requireAuth();

    const insforge = createServerClient()

    const { data: workOrders, error } = await insforge.database
        .from('WorkOrder')
        .select('*')
        .order('createdAt', { ascending: false })

    if (error) {
        console.error(error)
        return []
    }

    if (!workOrders || workOrders.length === 0) {
        return []
    }

    // Get invoice IDs
    const invoiceIds = workOrders.map(order => order.invoiceId).filter(Boolean)

    // Get invoices separately
    const { data: invoices } = invoiceIds.length > 0
        ? await insforge.database
            .from('Invoice')
            .select('*')
            .in('id', invoiceIds)
        : { data: [] }

    // Get invoice items
    const { data: invoiceItems } = invoiceIds.length > 0
        ? await insforge.database
            .from('InvoiceItem')
            .select('*')
            .in('invoiceId', invoiceIds)
        : { data: [] }

    // Get clients
    const clientIds = (invoices || []).map(inv => inv.clientId).filter(Boolean)
    const { data: clients } = clientIds.length > 0
        ? await insforge.database
            .from('Client')
            .select('*')
            .in('id', clientIds)
        : { data: [] }

    return workOrders.map(order => {
        const invoice = (invoices || []).find(inv => inv.id === order.invoiceId)
        const items = (invoiceItems || []).filter(item => item.invoiceId === order.invoiceId)
        const client = invoice ? (clients || []).find(c => c.id === invoice.clientId) : null

        return {
            ...order,
            invoice: invoice ? {
                ...invoice,
                total: Number(invoice.total),
                items: items.map(item => ({
                    ...item,
                    price: Number(item.price)
                })),
                client
            } : null
        }
    })
}
