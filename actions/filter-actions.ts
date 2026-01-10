"use server"

import { prisma } from "@/lib/prisma"
import type { Client, Invoice } from "@prisma/client"

interface InvoiceWithNumberTotal extends Omit<Invoice, 'total'> {
    total: number
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

/**
 * Filtra clientes según los criterios especificados
 */
export async function filterClients(filters: ClientFilters): Promise<Client[]> {
    const where: {
        name?: { contains: string; mode: 'insensitive' }
        rnc?: { contains: string; mode: 'insensitive' }
        createdAt?: { gte?: Date; lte?: Date }
        id?: string
    } = {}

    if (filters.name) {
        where.name = { contains: filters.name, mode: 'insensitive' }
    }

    if (filters.rnc) {
        where.rnc = { contains: filters.rnc, mode: 'insensitive' }
    }

    if (filters.startDate || filters.endDate) {
        where.createdAt = {}
        if (filters.startDate) {
            where.createdAt.gte = filters.startDate
        }
        if (filters.endDate) {
            // Incluir todo el día final
            const endOfDay = new Date(filters.endDate)
            endOfDay.setHours(23, 59, 59, 999)
            where.createdAt.lte = endOfDay
        }
    }

    // Buscar clientes que tengan facturas específicas
    if (filters.invoiceId) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: filters.invoiceId },
            select: { clientId: true }
        })
        if (invoice && invoice.clientId) {
            where.id = invoice.clientId
        }
    }

    return prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' }
    })
}

/**
 * Filtra facturas según los criterios especificados
 */
export async function filterInvoices(filters: InvoiceFilters): Promise<InvoiceWithNumberTotal[]> {
    const where: {
        createdAt?: { gte?: Date; lte?: Date }
        total?: { gte?: number; lte?: number }
    } = {}

    // Periodos predefinidos
    if (filters.period) {
        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        switch (filters.period) {
            case 'today':
                where.createdAt = { gte: startOfDay }
                break
            case 'week':
                const startOfWeek = new Date(now)
                startOfWeek.setDate(now.getDate() - now.getDay())
                startOfWeek.setHours(0, 0, 0, 0)
                where.createdAt = { gte: startOfWeek }
                break
            case 'month':
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
                where.createdAt = { gte: startOfMonth }
                break
            case 'year':
                const startOfYear = new Date(now.getFullYear(), 0, 1)
                where.createdAt = { gte: startOfYear }
                break
        }
    }

    // Rango de fechas personalizado
    if (filters.startDate || filters.endDate) {
        where.createdAt = where.createdAt || {}
        if (filters.startDate) {
            where.createdAt.gte = filters.startDate
        }
        if (filters.endDate) {
            // Incluir todo el día final
            const endOfDay = new Date(filters.endDate)
            endOfDay.setHours(23, 59, 59, 999)
            where.createdAt.lte = endOfDay
        }
    }

    // Rango de montos
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
        where.total = {}
        if (filters.minAmount !== undefined) {
            where.total.gte = filters.minAmount
        }
        if (filters.maxAmount !== undefined) {
            where.total.lte = filters.maxAmount
        }
    }

    const invoices = await prisma.invoice.findMany({
        where,
        include: {
            client: true,
            items: true,
            workOrder: true
        },
        orderBy: { createdAt: 'desc' }
    })

    // Convertir Decimal a number
    return invoices.map(invoice => ({
        ...invoice,
        total: Number(invoice.total),
        items: invoice.items.map(item => ({
            ...item,
            price: Number(item.price)
        }))
    }))
}

/**
 * Obtiene estadísticas de facturas filtradas
 */
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
