"use client"

import { Button } from "@/components/ui/button"
import { MobileSidebar } from "@/components/layout/mobile-sidebar"

interface UserProps {
    id: string
    name: string | null
    username: string
    role: "ADMIN" | "SELLER" | "ACCOUNTANT" | "TECHNICIAN" | "MANAGER" | "CUSTOM" | string
}

interface NavbarProps {
    user: UserProps | null
}

export function Navbar({ user }: NavbarProps) {
    return (
        <div className="flex items-center p-4">
            <MobileSidebar user={user} />
            <div className="flex w-full justify-end">
                {/* User Button or identifying info */}
                <div className="flex items-center gap-x-2">
                    <Button size="sm" variant="outline">
                        {user?.name || "Usuario"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
