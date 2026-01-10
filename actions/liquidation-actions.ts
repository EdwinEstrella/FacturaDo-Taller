"use server"

import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay } from "date-fns"

interface LiquidationParams {
    userId: string
    startDate: Date
    endDate: Date
}

export async function getLiquidationData({ userId, startDate, endDate }: LiquidationParams) {
    try {
        // Fetch Invoices created by User in Range
        const invoices = await prisma.invoice.findMany({
            where: {
                createdById: userId,
                createdAt: {
                    gte: startOfDay(startDate),
                    lte: endOfDay(endDate),
                },
                status: { not: "CANCELLED" } // Include PAID and PENDING? Usually commissions are on Total Sales.
            },
            // include: {
            //    payments: true 
            // }
        })

        // Fetch user details
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, role: true }
        })

        if (!user) throw new Error("User not found")

        // Calculate Totals
        const totalSales = invoices.reduce((acc, inv) => acc + Number(inv.total), 0)
        const totalPaid = invoices.filter(i => i.status === "PAID").reduce((acc, inv) => acc + Number(inv.total), 0)
        const initialPending = invoices.filter(i => i.status === "PENDING").reduce((acc, inv) => acc + Number(inv.total), 0)

        // Count invoices
        const count = invoices.length

        return {
            success: true,
            data: {
                user,
                invoices: invoices.map(i => ({
                    id: i.id,
                    sequenceNumber: i.sequenceNumber,
                    createdAt: i.createdAt,
                    clientName: i.clientName,
                    total: Number(i.total),
                    status: i.status
                })),
                summary: {
                    totalSales,
                    totalPaid,
                    initialPending,
                    count
                }
            }
        }
    } catch (error) {
        console.error("Liquidation error:", error)
        return { success: false, error: "Error al obtener datos" }
    }
}

export async function getUsersForLiquidation() {
    return await prisma.user.findMany({
        where: {
            role: { in: ["SELLER", "TECHNICIAN", "MANAGER"] }
        },
        select: { id: true, name: true, role: true }
    })
}
