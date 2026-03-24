import { NextResponse } from 'next/server'
import { createServerClient } from "@/lib/insforge/client"

export async function GET() {
    const insforge = createServerClient()

    try {
        // Get invoices that are paid but not dispatched
        const { data: invoices, error: invoicesError } = await insforge.database
            .from('Invoice')
            .select('*')
            .eq('dispatched', false)
            .eq('status', 'PAID')
            .order('createdAt', { ascending: false })

        if (invoicesError) {
            console.error("Error fetching invoices:", invoicesError)
        }

        // Get client IDs from invoices
        const clientIds = (invoices || []).map(inv => inv.clientId).filter(Boolean)

        // Get clients
        const { data: clients } = clientIds.length > 0
            ? await insforge.database
                .from('Client')
                .select('*')
                .in('id', clientIds)
            : { data: [] }

        // Get existing dispatches
        const { data: dispatches, error: dispatchesError } = await insforge.database
            .from('Dispatch')
            .select('*')
            .in('status', ['PENDING', 'ASSIGNED', 'IN_PROGRESS'])
            .order('createdAt', { ascending: false })

        if (dispatchesError) {
            console.error("Error fetching dispatches:", dispatchesError)
        }

        // Get invoices for dispatches
        const dispatchInvoiceIds = (dispatches || []).map(d => d.invoiceId).filter(Boolean)
        const { data: dispatchInvoices } = dispatchInvoiceIds.length > 0
            ? await insforge.database
                .from('Invoice')
                .select('*')
                .in('id', dispatchInvoiceIds)
            : { data: [] }

        // Get clients for dispatches
        const dispatchClientIds = (dispatchInvoices || []).map(inv => inv.clientId).filter(Boolean)
        const { data: dispatchClients } = dispatchClientIds.length > 0
            ? await insforge.database
                .from('Client')
                .select('*')
                .in('id', dispatchClientIds)
            : { data: [] }

        // Get technicians
        const technicianIds = (dispatches || []).map(d => d.technicianId).filter(Boolean)
        const { data: technicians } = technicianIds.length > 0
            ? await insforge.database
                .from('users')
                .select('id, name')
                .in('id', technicianIds)
            : { data: [] }

        // Format invoices with clients
        const formattedInvoices = (invoices || []).map(invoice => {
            const client = (clients || []).find(c => c.id === invoice.clientId)
            return {
                ...invoice,
                client: client ? {
                    name: client.name,
                    address: client.address
                } : null
            }
        })

        // Format dispatches with invoices and technicians
        const formattedDispatches = (dispatches || []).map(dispatch => {
            const invoice = (dispatchInvoices || []).find(inv => inv.id === dispatch.invoiceId)
            const client = invoice ? (dispatchClients || []).find(c => c.id === invoice.clientId) : null
            const technician = (technicians || []).find(t => t.id === dispatch.technicianId)

            return {
                ...dispatch,
                invoice: invoice ? {
                    ...invoice,
                    client: client ? {
                        name: client.name,
                        address: client.address
                    } : null
                } : null,
                technician: technician ? {
                    name: technician.name
                } : null
            }
        })

        return NextResponse.json({
            invoices: formattedInvoices,
            dispatches: formattedDispatches
        })
    } catch (error) {
        console.error("Error in /api/dispatches/pending:", error)
        return NextResponse.json({
            invoices: [],
            dispatches: []
        }, { status: 500 })
    }
}
