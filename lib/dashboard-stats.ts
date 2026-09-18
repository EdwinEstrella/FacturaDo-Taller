/**
 * Utilidades para estadísticas y comparaciones del dashboard
 */

import { createServerClient } from "./insforge/client"

interface ComparisonResult {
    current: number
    previous: number
    percentage: number
    isPositive: boolean
    text: string
}

/**
 * Calcula el cambio porcentual entre dos valores
 */
export function calculatePercentageChange(
    current: number,
    previous: number
): Omit<ComparisonResult, 'text'> {
    if (previous === 0) {
        return {
            current,
            previous,
            percentage: current > 0 ? 100 : 0,
            isPositive: current > 0,
        }
    }

    const percentage = ((current - previous) / previous) * 100

    return {
        current,
        previous,
        percentage,
        isPositive: percentage >= 0,
    }
}

/**
 * Genera el texto descriptivo del cambio
 */
export function getComparisonText(result: Omit<ComparisonResult, 'text'>): string {
    const sign = result.isPositive ? "+" : ""
    return `${sign}${result.percentage.toFixed(1)}% desde el mes pasado`
}

/**
 * Obtiene las fechas del mes actual y del mes anterior
 */
function getDateRanges() {
    const now = new Date()
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const firstDayOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastDayOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

    return {
        currentStart: firstDayOfCurrentMonth,
        previousStart: firstDayOfPreviousMonth,
        previousEnd: lastDayOfPreviousMonth,
    }
}

/**
 * Obtiene estadísticas de ingresos comparadas con el mes anterior
 */
export async function getRevenueComparison(): Promise<ComparisonResult & { text: string }> {
    const { currentStart, previousStart, previousEnd } = getDateRanges()
    const insforge = createServerClient()

    const [currentMonthResult, previousMonthResult] = await Promise.all([
        insforge.database
            .from('Payment')
            .select('amount')
            .gte('date', currentStart.toISOString()),
        insforge.database
            .from('Payment')
            .select('amount')
            .gte('date', previousStart.toISOString())
            .lte('date', previousEnd.toISOString()),
    ])

    const current = (currentMonthResult.data || []).reduce((sum, p) => sum + Number(p.amount), 0)
    const previous = (previousMonthResult.data || []).reduce((sum, p) => sum + Number(p.amount), 0)
    const result = calculatePercentageChange(current, previous)
    const text = getComparisonText(result)

    return {
        current,
        previous,
        percentage: result.percentage,
        isPositive: result.isPositive,
        text,
    }
}

/**
 * Obtiene estadísticas de clientes nuevos comparadas con el mes anterior
 */
export async function getClientComparison(): Promise<ComparisonResult & { text: string }> {
    const { currentStart, previousStart, previousEnd } = getDateRanges()
    const insforge = createServerClient()

    const [currentMonthResult, previousMonthResult] = await Promise.all([
        insforge.database
            .from('Client')
            .select('id', { count: 'exact', head: true })
            .gte('createdAt', currentStart.toISOString()),
        insforge.database
            .from('Client')
            .select('id', { count: 'exact', head: true })
            .gte('createdAt', previousStart.toISOString())
            .lte('createdAt', previousEnd.toISOString()),
    ])

    const current = currentMonthResult.count || 0
    const previous = previousMonthResult.count || 0
    const result = calculatePercentageChange(current, previous)
    const text = getComparisonText(result)

    return {
        current,
        previous,
        percentage: result.percentage,
        isPositive: result.isPositive,
        text,
    }
}

/**
 * Obtiene estadísticas de facturas comparadas con el mes anterior
 */
export async function getInvoiceComparison(): Promise<ComparisonResult & { text: string }> {
    const { currentStart, previousStart, previousEnd } = getDateRanges()
    const insforge = createServerClient()

    const [currentMonthResult, previousMonthResult] = await Promise.all([
        insforge.database
            .from('Invoice')
            .select('id', { count: 'exact', head: true })
            .gte('createdAt', currentStart.toISOString()),
        insforge.database
            .from('Invoice')
            .select('id', { count: 'exact', head: true })
            .gte('createdAt', previousStart.toISOString())
            .lte('createdAt', previousEnd.toISOString()),
    ])

    const current = currentMonthResult.count || 0
    const previous = previousMonthResult.count || 0
    const result = calculatePercentageChange(current, previous)
    const text = getComparisonText(result)

    return {
        current,
        previous,
        percentage: result.percentage,
        isPositive: result.isPositive,
        text,
    }
}

interface PeriodSummary {
    invoiceCount: number
    invoiceTotal: number
    quoteCount: number
    quoteTotal: number
}

/**
 * Obtiene el resumen de facturas y cotizaciones creadas dentro de un rango de fechas.
 * Se usa en la página de Analíticas, donde el período por defecto es el mes actual.
 */
export async function getAnalyticsSummary(from: Date, to: Date): Promise<PeriodSummary> {
    const insforge = createServerClient()
    const fromIso = from.toISOString()
    const toIso = to.toISOString()

    const [invoicesResult, quotesResult] = await Promise.all([
        insforge.database
            .from('Invoice')
            .select('total')
            .gte('createdAt', fromIso)
            .lte('createdAt', toIso),
        insforge.database
            .from('Quote')
            .select('total')
            .gte('createdAt', fromIso)
            .lte('createdAt', toIso),
    ])

    const invoices = (invoicesResult.data || []) as { total: string | number }[]
    const quotes = (quotesResult.data || []) as { total: string | number }[]

    return {
        invoiceCount: invoices.length,
        invoiceTotal: invoices.reduce((sum, i) => sum + Number(i.total ?? 0), 0),
        quoteCount: quotes.length,
        quoteTotal: quotes.reduce((sum, q) => sum + Number(q.total ?? 0), 0),
    }
}

/**
 * Obtiene el historial de ingresos de los últimos 6 meses para el gráfico
 */
export async function getFinancialHistory() {
    const today = new Date()
    const months: { name: string; date: Date; total: number }[] = []

    // Generate last 6 months
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        months.push({
            name: d.toLocaleString('es-ES', { month: 'short' }).charAt(0).toUpperCase() + d.toLocaleString('es-ES', { month: 'short' }).slice(1),
            date: d,
            total: 0
        })
    }

    const startPeriod = months[0].date
    const insforge = createServerClient()

    // Get payments
    const { data: payments } = await insforge.database
        .from('Payment')
        .select('amount, date')
        .gte('date', startPeriod.toISOString()) as { data: { amount: string | number; date: string }[] | null }

    // Sum by month
    (payments || []).forEach(p => {
        const monthIndex = months.findIndex(m =>
            new Date(p.date).getFullYear() === m.date.getFullYear() &&
            new Date(p.date).getMonth() === m.date.getMonth()
        )
        if (monthIndex !== -1) {
            months[monthIndex].total += Number(p.amount)
        }
    })

    return months.map(m => ({
        name: m.name,
        total: Math.round(m.total)
    }))
}
