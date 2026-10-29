"use server"


import { requireAuth } from "@/actions/auth-actions";
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
    status?: 'PAID' | 'PENDING' | 'CANCELLED'
    // Número de factura, NCF o nombre del cliente. Busca en todo el historial.
    search?: string
}

export async function filterClients(filters: ClientFilters): Promise<Client[]> {
    await requireAuth();

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
    await requireAuth();

    const insforge = createServerClient()

    let query = insforge.database
        .from('Invoice')
        .select(`
            *,
            client:Client(*),
            items:InvoiceItem(*),
            workOrder:WorkOrder(*),
            dispatchInfo:Dispatch(
                *,
                technician:users(*)
            )
        `)
        .order('createdAt', { ascending: false })

    // Los caracteres reservados del filtro `or` de PostgREST rompen la consulta.
    const search = (filters.search || "").replace(/[,()*%\\]/g, " ").trim()

    if (search) {
        const conditions = [`clientName.ilike.*${search}*`, `ncf.ilike.*${search}*`]
        const seq = search.replace(/^#|^(fac|fact)-?/i, "").replace(/^0+(?=\d)/, "")
        if (/^\d+$/.test(seq)) {
            conditions.push(`sequenceNumber.eq.${seq}`)
        }
        query = query.or(conditions.join(","))
    }

    // Predefined periods (una búsqueda ignora el período: se busca en todo el historial)
    if (filters.period && !search) {
        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        switch (filters.period) {
            case 'today':
                query = query.gte('createdAt', startOfDay.toISOString())
                break
            case 'week':
                const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
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
    if (filters.startDate && !search) {
        query = query.gte('createdAt', filters.startDate.toISOString())
    }

    if (filters.endDate && !search) {
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

    if (filters.status) {
        query = query.eq('status', filters.status)
    }

    const { data, error } = await query

    if (error) {
        console.error(error)
        return []
    }
    
    const allItems = (data || []).flatMap(inv => inv.items || [])
    const productIds = [...new Set(allItems.reduce<string[]>((acc, i: any) => {
        if (i.productId) acc.push(i.productId)
        return acc
    }, []))]
    
    let productsMap: Record<string, { unitType: string; measurementUnit: string | null }> = {}
    if (productIds.length > 0) {
        const { data: products } = await insforge.database
            .from('Product')
            .select('id, unitType, measurementUnit')
            .in('id', productIds)
            
        if (products) {
            productsMap = Object.fromEntries(products.map(p => [p.id, p]))
        }
    }

    return (data || []).map(invoice => ({
        ...invoice,
        total: Number(invoice.total),
        items: (invoice.items || []).map((item: any) => ({
            ...item,
            price: Number(item.price),
            unitType: item.productId ? productsMap[item.productId]?.unitType : 'UNIT',
            measurementUnit: item.productId ? productsMap[item.productId]?.measurementUnit : null
        }))
    }))
}
