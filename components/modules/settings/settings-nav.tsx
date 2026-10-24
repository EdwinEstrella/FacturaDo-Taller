"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, FileText, UserCog } from "lucide-react"
import { cn } from "@/lib/utils"
import { canAccess } from "@/lib/navigation"

export const SETTINGS_TABS = [
    { href: "/settings/general", label: "Empresa", description: "Datos, logo, factura e impresoras", icon: Building2 },
    { href: "/settings/fiscal", label: "Comprobantes fiscales", description: "Secuencias NCF", icon: FileText },
    { href: "/settings/users", label: "Usuarios", description: "Accesos y roles del equipo", icon: UserCog },
]

export function SettingsNav({ role }: { role?: string }) {
    const pathname = usePathname()
    const tabs = SETTINGS_TABS.filter((t) => canAccess(role, t.href))

    return (
        <nav className="flex gap-1 overflow-x-auto scrollbar-none lg:flex-col" aria-label="Secciones de ajustes">
            {tabs.map((t) => {
                const Icon = t.icon
                const active = pathname === t.href || pathname?.startsWith(`${t.href}/`)
                return (
                    <Link
                        key={t.href}
                        href={t.href}
                        className={cn(
                            "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                            active ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                        )}
                    >
                        <Icon className={cn("size-[18px] shrink-0", active ? "text-blue-600" : "text-slate-400")} />
                        <span className="min-w-0">
                            <span className="block font-medium">{t.label}</span>
                            <span className="hidden text-xs text-slate-500 lg:block">{t.description}</span>
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}

/** Bloque de ajustes: título y descripción a la izquierda, campos a la derecha. */
export function SettingsSection({ title, description, children, footer }: {
    title: string
    description?: string
    children: React.ReactNode
    footer?: React.ReactNode
}) {
    return (
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="grid gap-6 p-6 md:grid-cols-[240px_1fr] md:gap-10">
                <div className="space-y-1">
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                    {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
                </div>
                <div className="min-w-0 space-y-5">{children}</div>
            </div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t bg-slate-50/70 px-6 py-3">{footer}</div>}
        </section>
    )
}
