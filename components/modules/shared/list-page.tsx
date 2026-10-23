"use client"

import type { ReactNode } from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

/* Piezas compartidas para las pantallas de listado (Facturas, Cotizaciones). */

export function PageHeader({ title, description, actions }: {
    title: string
    description?: string
    actions?: ReactNode
}) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    )
}

const TILE_TONES = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
}

export function StatTile({ label, value, hint, icon, tone = "slate" }: {
    label: string
    value: ReactNode
    hint?: ReactNode
    icon: ReactNode
    tone?: keyof typeof TILE_TONES
}) {
    return (
        <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{label}</p>
                    <p className="truncate text-lg font-bold tabular-nums tracking-tight sm:text-2xl">{value}</p>
                    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                </div>
                <div className={cn("hidden shrink-0 rounded-lg p-2.5 sm:block [&_svg]:size-5", TILE_TONES[tone])}>{icon}</div>
            </div>
        </div>
    )
}

export function SearchInput({ value, onChange, placeholder, className, autoFocus }: {
    value: string
    onChange: (value: string) => void
    placeholder: string
    className?: string
    autoFocus?: boolean
}) {
    return (
        <div className={cn("relative", className)}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
                type="search"
                value={value}
                autoFocus={autoFocus}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className="h-10 w-full rounded-lg border bg-background pl-9 pr-9 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    aria-label="Borrar búsqueda"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    )
}

export function SegmentedControl<T extends string>({ options, value, onChange, className }: {
    options: { value: T; label: string; count?: number }[]
    value: T
    onChange: (value: T) => void
    className?: string
}) {
    return (
        <div className={cn("inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-1", className)}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition",
                        value === opt.value
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    {opt.label}
                    {opt.count !== undefined && (
                        <span className={cn(
                            "rounded-full px-1.5 text-xs tabular-nums",
                            value === opt.value ? "bg-muted text-foreground" : "bg-background/60"
                        )}>
                            {opt.count}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
}

const PILL_TONES = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    red: "bg-red-50 text-red-700 ring-red-600/20",
    slate: "bg-slate-50 text-slate-600 ring-slate-500/20",
    blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
}

const DOT_TONES = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    slate: "bg-slate-400",
    blue: "bg-blue-500",
}

export type PillTone = keyof typeof PILL_TONES

export function StatusPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
    return (
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", PILL_TONES[tone])}>
            <span className={cn("size-1.5 rounded-full", DOT_TONES[tone])} />
            {children}
        </span>
    )
}

export function ClientCell({ name, detail }: { name: string; detail?: ReactNode }) {
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("")
    return (
        <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {initials || "?"}
            </div>
            <div className="min-w-0">
                <p className="truncate font-medium">{name}</p>
                {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
            </div>
        </div>
    )
}

export function EmptyList({ icon, title, description, action }: {
    icon: ReactNode
    title: string
    description?: string
    action?: ReactNode
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="rounded-full bg-muted p-4 text-muted-foreground [&_svg]:size-6">{icon}</div>
            <div className="space-y-1">
                <p className="font-semibold">{title}</p>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            {action}
        </div>
    )
}
