"use client"

import { AppSidebar } from "@/components/layout/app-sidebar"
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
            <div className="flex h-screen overflow-hidden bg-slate-50">
                <div className="hidden md:flex">
                    <AppSidebar role={user?.role} />
                </div>

                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <Navbar user={user} hasActiveShift={hasActiveShift} />
                    <main className="flex-1 overflow-y-auto">
                        <div className="mx-auto w-full max-w-[1500px] p-4 md:p-8">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </ShiftGuardProvider>
    )
}
