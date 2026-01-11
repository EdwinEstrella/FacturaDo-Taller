/**
 * Utilidades para estadísticas y comparaciones del dashboard
 */

import { prisma } from "./prisma"

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

    const [currentMonth, previousMonth] = await Promise.all([
        prisma.invoice.aggregate({
            where: {
                status: 'PAID',
                createdAt: { gte: currentStart },
            },
            _sum: { total: true },
        }),
        prisma.invoice.aggregate({
            where: {
                status: 'PAID',
                createdAt: {
                    gte: previousStart,
                    lte: previousEnd,
                },
            },
            _sum: { total: true },
        }),
    ])

    const current = Number(currentMonth._sum.total || 0)
    const previous = Number(previousMonth._sum.total || 0)
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

    const [currentMonth, previousMonth] = await Promise.all([
        prisma.client.count({
            where: { createdAt: { gte: currentStart } },
        }),
        prisma.client.count({
            where: {
                createdAt: {
                    gte: previousStart,
                    lte: previousEnd,
                },
            },
        }),
    ])

    const result = calculatePercentageChange(currentMonth, previousMonth)
    const text = getComparisonText(result)

    return {
        current: currentMonth,
        previous: previousMonth,
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

    const [currentMonth, previousMonth] = await Promise.all([
        prisma.invoice.count({
            where: { createdAt: { gte: currentStart } },
        }),
        prisma.invoice.count({
            where: {
                createdAt: {
                    gte: previousStart,
                    lte: previousEnd,
                },
            },
        }),
    ])

    const result = calculatePercentageChange(currentMonth, previousMonth)
    const text = getComparisonText(result)

    return {
        current: currentMonth,
        previous: previousMonth,
        percentage: result.percentage,
        isPositive: result.isPositive,
        text,
    }
}

/**
 * Obtiene el historial de ingresos de los últimos 6 meses para el gráfico
 */
export async function getFinancialHistory() {
    const today = new Date()
    const months: { name: string; date: Date; total: number }[] = []

    // Generar nombres de los últimos 6 meses
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        months.push({
            name: d.toLocaleString('es-ES', { month: 'short' }).charAt(0).toUpperCase() + d.toLocaleString('es-ES', { month: 'short' }).slice(1),
            date: d,
            total: 0
        })
    }

    const startPeriod = months[0].date

    // Agrupar facturas por mes
    // Use aggregation to sum totals per month
    const paidInvoices = await prisma.invoice.findMany({
        where: {
            status: 'PAID',
            createdAt: { gte: startPeriod }
        },
        select: {
            total: true,
            createdAt: true
        }
    })

    // Sum by month
    paidInvoices.forEach(inv => {
        // Find matching month
        const monthIndex = months.findIndex(m =>
            inv.createdAt.getFullYear() === m.date.getFullYear() &&
            inv.createdAt.getMonth() === m.date.getMonth()
        )
        if (monthIndex !== -1) {
            months[monthIndex].total += Number(inv.total)
        }
    })

    return months.map(m => ({
        name: m.name,
        total: Math.round(m.total)
    }))
}
