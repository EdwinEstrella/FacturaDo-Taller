"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, LogOut, Menu, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { TitlebarUpdateButton } from "@/components/modules/updates/titlebar-update-button"
import { useAppUpdate } from "@/hooks/use-app-update"
import { canAccess, findNavItem } from "@/lib/navigation"
import { cn } from "@/lib/utils"

interface UserProps {
    id: string
    name: string | null
    username: string
    role: "ADMIN" | "SELLER" | "ACCOUNTANT" | "TECHNICIAN" | "MANAGER" | "CUSTOM" | string
}

const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Administrador",
    MANAGER: "Supervisor",
    SELLER: "Vendedor",
    ACCOUNTANT: "Contador",
    TECHNICIAN: "Técnico",
    CUSTOM: "Personalizado",
}

export function Navbar({ user, hasActiveShift }: { user: UserProps | null; hasActiveShift: boolean }) {
    const pathname = usePathname()
    const router = useRouter()
    const update = useAppUpdate()
    const [mobileOpen, setMobileOpen] = useState(false)
    const current = findNavItem(pathname)
    const role = user?.role
    const name = user?.name || user?.username || "Usuario"
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")

    useEffect(() => {
        if (update.upToDate) toast.success(`Estás al día${update.currentVersion ? ` (v${update.currentVersion})` : ""}`)
    }, [update.upToDate, update.currentVersion])

    const logout = async () => {
        const { logout } = await import("@/actions/auth-actions")
        await logout()
        router.push("/login")
    }

    return (
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur md:px-6">
            {/* Menú en pantallas pequeñas */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                    <button type="button" className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Abrir menú">
                        <Menu className="size-5" />
                    </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 border-0 p-0">
                    <SheetTitle className="sr-only">Menú</SheetTitle>
                    <AppSidebar role={role} collapsible={false} onNavigate={() => setMobileOpen(false)} />
                </SheetContent>
            </Sheet>

            {/* Ubicación */}
            <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Ubicación">
                {current ? (
                    <>
                        <span className="hidden text-slate-500 sm:inline">{current.section}</span>
                        <ChevronRight className="hidden size-4 text-slate-300 sm:inline" />
                        <span className="truncate font-semibold text-slate-900">{current.item.label}</span>
                    </>
                ) : (
                    <span className="font-semibold text-slate-900">FacturaDo</span>
                )}
            </nav>

            <div className="ml-auto flex items-center gap-2 md:gap-3">
                <TitlebarUpdateButton update={update} />

                {canAccess(role, "/daily-close") && (
                    <Link
                        href="/daily-close"
                        className={cn(
                            "hidden h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition sm:flex",
                            hasActiveShift
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        )}
                        title={hasActiveShift ? "Hay un turno de caja abierto" : "No hay turno de caja abierto"}
                    >
                        <span className={cn("size-2 rounded-full", hasActiveShift ? "bg-emerald-500" : "bg-slate-400")} />
                        {hasActiveShift ? "Caja abierta" : "Caja cerrada"}
                    </Link>
                )}

                <div className="hidden h-6 w-px bg-slate-200 sm:block" />

                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg p-1 pr-2 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500">
                        <div className="flex size-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                            {initials || "U"}
                        </div>
                        <div className="hidden text-left leading-tight md:block">
                            <p className="max-w-[160px] truncate text-sm font-medium text-slate-900">{name}</p>
                            <p className="text-xs text-slate-500">{ROLE_LABELS[(role || "").toUpperCase()] || role}</p>
                        </div>
                        <ChevronDown className="hidden size-4 text-slate-400 md:block" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={8} className="w-60">
                        <DropdownMenuLabel className="font-normal">
                            <p className="truncate text-sm font-medium">{name}</p>
                            <p className="text-xs text-muted-foreground">@{user?.username}</p>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {update.phase !== "unsupported" && (
                            <>
                                <DropdownMenuItem
                                    className="cursor-pointer gap-2"
                                    disabled={update.phase === "checking" || update.phase === "downloading" || update.phase === "installing"}
                                    onClick={update.phase === "ready" ? update.install : update.check}
                                >
                                    <RefreshCw className={cn("size-4", update.phase === "checking" && "animate-spin")} />
                                    {update.phase === "ready"
                                        ? "Reiniciar y actualizar"
                                        : update.phase === "checking"
                                            ? "Buscando actualizaciones..."
                                            : "Buscar actualizaciones"}
                                </DropdownMenuItem>
                                {update.currentVersion && (
                                    <p className="px-2 pb-1.5 pt-0.5 text-xs text-muted-foreground">Versión {update.currentVersion}</p>
                                )}
                                <DropdownMenuSeparator />
                            </>
                        )}
                        <DropdownMenuItem className="cursor-pointer gap-2 text-red-600 focus:bg-red-50 focus:text-red-700" onClick={logout}>
                            <LogOut className="size-4" />
                            Cerrar sesión
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
