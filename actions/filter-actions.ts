"use server"

import { createServerClient } from "@/lib/insforge/client"
import type { Client, Invoice, InvoiceItem } from "@/types"

interface InvoiceWithNumberTotal extends Omit<Invoice, 'total'> {
    total: number
    items: InvoiceItem[]
}

interface ClientFilters {
    name?: string
    rnc?: string
    startDate?: Date
    endDate?: Date
    invoiceId?: string
}

interface InvoiceFilters {
    startDate?: Date
    endDate?: Date
    minAmount?: number
    maxAmount?: number
    period?: 'today' | 'week' | 'month' | 'year'
}

export async function filterClients(filters: ClientFilters): Promise<Client[]> {
    const insforge = createServerClient()

    let query = insforge.database
        .from('Client')
        .select('*')
        .order('createdAt', { ascending: false })

    // Apply filters
    if (filters.name) {
        query = query.ilike('name', `%${filters.name}%`)
    }

    if (filters.rnc) {
        query = query.ilike('rnc', `%${filters.rnc}%`)
    }

    if (filters.startDate) {
        query = query.gte('createdAt', filters.startDate.toISOString())
    }

    if (filters.endDate) {
        const endOfDay = new Date(filters.endDate)
        endOfDay.setHours(23, 59, 59, 999)
        query = query.lte('createdAt', endOfDay.toISOString())
    }

    // Search clients with specific invoice
    if (filters.invoiceId) {
        const { data: invoice } = await insforge.database
            .from('Invoice')
            .select('clientId')
            .eq('id', filters.invoiceId)
            .single()

        if (invoice && invoice.clientId) {
            query = query.eq('id', invoice.clientId)
        }
    }

    const { data, error } = await query

    if (error) {
        console.error(error)
        return []
    }

    return data || []
}

export async function filterInvoices(filters: InvoiceFilters): Promise<InvoiceWithNumberTotal[]> {
    const insforge = createServerClient()

    let query = insforge.database
        .from('Invoice')
        .select(`
            *,
            client:Client(*),
            items:InvoiceItem(*),
            workOrder:WorkOrder(*)
        `)
        .order('createdAt', { ascending: false })

    // Predefined periods
    if (filters.period) {
        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        switch (filters.period) {
            case 'today':
                query = query.gte('createdAt', startOfDay.toISOString())
                break
            case 'week':
                const startOfWeek = new Date(now)
                startOfWeek.setDate(now.getDate() - now.getDay())
                startOfWeek.setHours(0, 0, 0, 0)
                query = query.gte('createdAt', startOfWeek.toISOString())
                break
            case 'month':
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
                query = query.gte('createdAt', startOfMonth.toISOString())
                break
            case 'year':
                const startOfYear = new Date(now.getFullYear(), 0, 1)
                query = query.gte('createdAt', startOfYear.toISOString())
                break
        }
    }

    // Custom date range
    if (filters.startDate) {
        query = query.gte('createdAt', filters.startDate.toISOString())
    }

    if (filters.endDate) {
        const endOfDay = new Date(filters.endDate)
        endOfDay.setHours(23, 59, 59, 999)
        query = query.lte('createdAt', endOfDay.toISOString())
    }

    // Amount range
    if (filters.minAmount !== undefined) {
        query = query.gte('total', filters.minAmount)
    }

    if (filters.maxAmount !== undefined) {
        query = query.lte('total', filters.maxAmount)
    }

    const { data, error } = await query

    if (error) {
        console.error(error)
        return []
    }

    return (data || []).map(invoice => ({
        ...invoice,
        total: Number(invoice.total),
        items: (invoice.items || []).map((item: InvoiceItem) => ({
            ...item,
            price: Number(item.price)
        }))
    }))
}

export async function getInvoiceStats(filters: InvoiceFilters) {
    const invoices = await filterInvoices(filters)

    const stats = {
        count: invoices.length,
        total: invoices.reduce((sum, inv) => sum + inv.total, 0),
        paid: invoices.filter(inv => inv.status === 'PAID').length,
        pending: invoices.filter(inv => inv.status === 'PENDING').length
    }

    return stats
}