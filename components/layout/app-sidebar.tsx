"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { getNavSections, isActivePath } from "@/lib/navigation"

const COLLAPSED_KEY = "fd.sidebar.collapsed"

// Colores del menú lateral (oscuro, con contraste alto en textos e íconos).
const t = {
    aside: "bg-slate-900 text-slate-200",
    divider: "border-white/10",
    dividerBg: "bg-white/10",
    brandTitle: "text-white",
    brandSub: "text-slate-400",
    section: "text-slate-400",
    item: "text-slate-200 hover:bg-white/10 hover:text-white",
    itemActive: "bg-blue-600 text-white shadow-sm shadow-blue-950/40",
    icon: "text-slate-400 group-hover:text-white",
    iconActive: "text-white",
    footer: "text-slate-300 hover:bg-white/10 hover:text-white",
}

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
                "flex h-full shrink-0 flex-col transition-[width] duration-200", t.aside,
                isCollapsed ? "w-[72px]" : "w-64"
            )}
        >
            {/* Marca */}
            <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b", t.divider, isCollapsed ? "justify-center px-0" : "px-5")}>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-sm">
                    FD
                </div>
                {!isCollapsed && (
                    <div className="min-w-0 leading-tight">
                        <p className={cn("text-[15px] font-semibold tracking-tight", t.brandTitle)}>FacturaDo</p>
                        <p className={cn("text-[11px]", t.brandSub)}>Gestión de taller</p>
                    </div>
                )}
            </div>

            {/* Navegación */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-width:thin]">
                {sections.map((section, idx) => (
                    <div key={section.title} className={cn(idx > 0 && "mt-5")}>
                        {isCollapsed ? (
                            idx > 0 && <div className={cn("mx-auto mb-3 h-px w-6", t.dividerBg)} />
                        ) : (
                            <p className={cn("mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em]", t.section)}>
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
                                                active ? t.itemActive : t.item
                                            )}
                                        >
                                            <Icon className={cn("size-[18px] shrink-0", active ? t.iconActive : t.icon)} />
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
                <div className={cn("shrink-0 border-t p-3", t.divider)}>
                    <button
                        type="button"
                        onClick={toggle}
                        className={cn(
                            "flex h-9 w-full items-center gap-3 rounded-lg text-[13px] transition-colors", t.footer,
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
