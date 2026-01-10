"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/layout/sidebar"
import { Navbar } from "@/components/layout/navbar"

interface UserProps {
    id: string
    name: string | null
    username: string
    role: "ADMIN" | "SELLER" | "ACCOUNTANT" | "TECHNICIAN" | "MANAGER" | "CUSTOM" | string
}

interface DashboardShellProps {
    children: React.ReactNode
    user: UserProps | null
}

export function DashboardShell({ children, user }: DashboardShellProps) {
    // Start collapsed only on very small screens if we wanted logic there, 
    // but here we just default to expanded for desktop as requested or standard behavior.
    // However, user might want to persist this state. For now, local state.
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true)
    }, [])

    return (
        <div className="h-full relative">
            <div className={cn(
                "hidden h-full md:flex md:flex-col md:fixed md:inset-y-0 z-[80] bg-gray-900 transition-all duration-300",
                isCollapsed ? "md:w-20" : "md:w-72"
            )}>
                <Sidebar
                    user={user}
                    isCollapsed={isCollapsed}
                    setIsCollapsed={setIsCollapsed}
                />
            </div>
            <main className={cn(
                "transition-all duration-300",
                isCollapsed ? "md:pl-20" : "md:pl-72"
            )}>
                <Navbar user={user} />
                {children}
            </main>
        </div>
    )
}
