"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { getNavSections, isActivePath } from "@/lib/navigation"

const COLLAPSED_KEY = "fd.sidebar.collapsed"

export function AppSidebar({ role, collapsible = true, onNavigate }: {
    role?: string
    collapsible?: boolean
    onNavigate?: () => void
}) {
    const pathname = usePathname()
    const [collapsed, setCollapsed] = useState(false)
    const sections = getNavSections(role)

    useEffect(() => {
        if (!collapsible) return
        try {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia guardada, solo existe en el cliente
            setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1")
        } catch { /* sin almacenamiento: queda expandido */ }
    }, [collapsible])

    const toggle = () => {
        setCollapsed((c) => {
            try { localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1") } catch { /* noop */ }
            return !c
        })
    }

    const isCollapsed = collapsible && collapsed

    return (
        <aside
            className={cn(
                "flex h-full shrink-0 flex-col bg-slate-950 text-slate-300 transition-[width] duration-200",
                isCollapsed ? "w-[72px]" : "w-64"
            )}
        >
            {/* Marca */}
            <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b border-white/10", isCollapsed ? "justify-center px-0" : "px-5")}>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-blue-900/40">
                    FD
                </div>
                {!isCollapsed && (
                    <div className="min-w-0 leading-tight">
                        <p className="text-[15px] font-semibold tracking-tight text-white">FacturaDo</p>
                        <p className="text-[11px] text-slate-400">Gestión de taller</p>
                    </div>
                )}
            </div>

            {/* Navegación */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.700)_transparent]">
                {sections.map((section, idx) => (
                    <div key={section.title} className={cn(idx > 0 && "mt-5")}>
                        {isCollapsed ? (
                            idx > 0 && <div className="mx-auto mb-3 h-px w-6 bg-white/10" />
                        ) : (
                            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                {section.title}
                            </p>
                        )}
                        <ul className="space-y-0.5">
                            {section.items.map((item) => {
                                const Icon = item.icon
                                const active = isActivePath(pathname, item.href)
                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            onClick={onNavigate}
                                            title={isCollapsed ? item.label : undefined}
                                            className={cn(
                                                "group relative flex h-9 items-center gap-3 rounded-lg text-[13.5px] font-medium transition-colors",
                                                isCollapsed ? "justify-center px-0" : "px-3",
                                                active
                                                    ? "bg-white/[0.08] text-white"
                                                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                                            )}
                                        >
                                            {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-500" />}
                                            <Icon className={cn("size-[18px] shrink-0", active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300")} />
                                            {!isCollapsed && <span className="truncate">{item.label}</span>}
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            {collapsible && (
                <div className="shrink-0 border-t border-white/10 p-3">
                    <button
                        type="button"
                        onClick={toggle}
                        className={cn(
                            "flex h-9 w-full items-center gap-3 rounded-lg text-[13px] text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-100",
                            isCollapsed ? "justify-center" : "px-3"
                        )}
                        title={isCollapsed ? "Expandir menú" : "Contraer menú"}
                    >
                        {isCollapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
                        {!isCollapsed && <span>Contraer menú</span>}
                    </button>
                </div>
            )}
        </aside>
    )
}
