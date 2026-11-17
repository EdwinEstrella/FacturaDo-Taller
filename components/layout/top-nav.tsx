"use client"

import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { usePathname } from "next/navigation"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getNavSections, isActivePath } from "@/lib/navigation"
import { cn } from "@/lib/utils"

const sectionButton =
    "flex h-6 items-center rounded px-2 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
const sectionIdle = "text-[#cccccc] hover:bg-white/10 hover:text-white data-[state=open]:bg-white/10"
const sectionActive = "text-white hover:bg-white/10 data-[state=open]:bg-white/10"

/**
 * Top-bar navigation: one button per menu section. A section with a single entry links directly;
 * the others open an in-app dropdown (Radix, never a native menu) with their pages.
 */
export function TopNav({ role }: { role?: string }) {
    const pathname = usePathname()
    const sections = getNavSections(role)

    return (
        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto scrollbar-none" aria-label="Menú principal">
            {sections.map((section) => {
                const active = section.items.some((item) => isActivePath(pathname, item.href))

                if (section.items.length === 1) {
                    const [item] = section.items
                    return (
                        <Link
                            key={section.title}
                            href={item.href}
                            className={cn(sectionButton, "shrink-0", active ? sectionActive : sectionIdle)}
                        >
                            {item.label}
                        </Link>
                    )
                }

                return (
                    <DropdownMenu key={section.title} modal={false}>
                        <DropdownMenuTrigger className={cn(sectionButton, "shrink-0", active ? sectionActive : sectionIdle)}>
                            {section.title}
                            <ChevronDown className="ml-1 size-3 opacity-70" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" sideOffset={6} className="w-60">
                            {section.items.map((item) => {
                                const Icon = item.icon
                                const itemActive = isActivePath(pathname, item.href)
                                return (
                                    <DropdownMenuItem key={item.href} asChild className="cursor-pointer gap-2.5 py-2">
                                        <Link
                                            href={item.href}
                                            className={cn(itemActive && "bg-blue-50 font-semibold text-blue-700")}
                                        >
                                            <Icon className={cn("size-4", itemActive ? "text-blue-600" : "text-slate-500")} />
                                            {item.label}
                                        </Link>
                                    </DropdownMenuItem>
                                )
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            })}
        </nav>
    )
}
