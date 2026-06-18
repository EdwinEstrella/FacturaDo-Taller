"use server"


import { requireAuth } from "@/actions/auth-actions";
import { createServerClient } from "@/lib/insforge/client"
import { startOfDay, endOfDay } from "date-fns"

interface LiquidationParams {
    userId: string
    startDate: Date
    endDate: Date
}

export async function getLiquidationData({
    await requireAuth();
 userId, startDate, endDate }: LiquidationParams) {
    const insforge = createServerClient()

    try {
        // Fetch Invoices created by User in Range
        const { data: invoices } = await insforge.database
            .from('Invoice')
            .select('*')
            .eq('createdById', userId)
            .gte('createdAt', startOfDay(startDate).toISOString())
            .lte('createdAt', endOfDay(endDate).toISOString())
            .neq('status', "CANCELLED")

        // Fetch user details
        const { data: user } = await insforge.database
            .from('users')
            .select('name, role')
            .eq('id', userId)
            .single()

        if (!user) {
            throw new Error("User not found")
        }

        // Calculate Totals
        const totalSales = (invoices || []).reduce((acc, inv) => acc + Number(inv.total), 0)
        const totalPaid = (invoices || []).filter(i => i.status === "PAID").reduce((acc, inv) => acc + Number(inv.total), 0)
        const initialPending = (invoices || []).filter(i => i.status === "PENDING").reduce((acc, inv) => acc + Number(inv.total), 0)

        const count = invoices?.length || 0

        return {
            success: true,
            data: {
                user,
                invoices: (invoices || []).map(i => ({
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
    await requireAuth();

    const insforge = createServerClient()

    const { data, error } = await insforge.database
        .from('users')
        .select('id, name, role')
        .in('role', ["SELLER", "TECHNICIAN", "MANAGER"])

    if (error) {
        console.error(error)
        return []
    }

    return data || []
}
