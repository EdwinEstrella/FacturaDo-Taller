"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import dynamic from 'next/dynamic'

// Dynamically import SessionNavBar
const SessionNavBarComponent = dynamic(() => import('@/components/ui/sidebar').then(mod => mod.SessionNavBar), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-white" />
})

interface UserProps {
    id: string
    name: string | null
    username: string
    role: "ADMIN" | "SELLER" | "ACCOUNTANT" | "TECHNICIAN" | "MANAGER" | "CUSTOM" | string
}

interface MobileSidebarProps {
    user: UserProps | null
}

export function MobileSidebar({ user }: MobileSidebarProps) {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsMounted(true)
    }, [])

    if (!isMounted) {
        return null
    }

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-white border-r w-auto text-black">
                <SessionNavBarComponent user={user} />
            </SheetContent>
        </Sheet>
    )
}
