"use client"

import { SessionNavBar } from "@/components/ui/sidebar"
import { Navbar } from "@/components/layout/navbar"
import { ShiftGuardProvider } from "@/components/modules/cash-close/closed-shift-dialog"
import type { CashShiftRecord } from "@/actions/cash-shift-actions"

interface UserProps {
    id: string
    name: string | null
    username: string
    role: "ADMIN" | "SELLER" | "ACCOUNTANT" | "TECHNICIAN" | "MANAGER" | "CUSTOM" | string
}

interface DashboardShellProps {
    children: React.ReactNode
    user: UserProps | null
    hasActiveShift?: boolean
    lastClosedShift?: CashShiftRecord | null
}

export function DashboardShell({
    children,
    user,
    hasActiveShift = true
}: DashboardShellProps) {
    return (
        <ShiftGuardProvider hasActiveShift={hasActiveShift}>
            <div className="flex h-screen overflow-hidden bg-gray-100 relative">
                {/* Sidebar is distinct flow, hidden on mobile by default usually, but we keep md:flex logic */}
                <div className="hidden md:flex flex-shrink-0 bg-white h-screen">
                    <SessionNavBar user={user} />
                </div>

                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    <Navbar user={user} />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6">
                        {children}
                    </main>
                </div>
            </div>
        </ShiftGuardProvider>
    )
}
