"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ChevronDown, LogOut, Menu, RefreshCw } from "lucide-react"
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
import { TopNav } from "@/components/layout/top-nav"
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
        <header className="titlebar-drag titlebar-controls-gap flex h-9 shrink-0 items-center gap-2 bg-[#1c1c1c] pl-2 text-white select-none">
            {/* Menú en pantallas pequeñas */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                    <button type="button" className="titlebar-no-drag rounded-md p-1.5 text-slate-300 hover:bg-white/10 md:hidden" aria-label="Abrir menú">
                        <Menu className="size-5" />
                    </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 border-0 p-0">
                    <SheetTitle className="sr-only">Menú</SheetTitle>
                    <AppSidebar role={role} collapsible={false} onNavigate={() => setMobileOpen(false)} />
                </SheetContent>
            </Sheet>

            {/* Marca */}
            <Link href="/" className="titlebar-no-drag flex shrink-0 items-center gap-2" title="FacturaDo">
                <div className="flex size-6 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white shadow-sm">
                    FD
                </div>
                <span className="hidden text-[13px] font-medium text-white lg:inline">FacturaDo</span>
            </Link>

            <div className="hidden h-4 w-px bg-white/20 md:block" />

            {/* Menú principal (pantallas medianas y grandes) */}
            <div className="titlebar-no-drag hidden min-w-0 md:flex">
                <TopNav role={role} />
            </div>

            {/* Ubicación (solo pantallas pequeñas, donde el menú va en el panel lateral) */}
            <span className="truncate text-[13px] font-medium text-white md:hidden">
                {current?.item.label || "FacturaDo"}
            </span>

            <div className="titlebar-no-drag ml-auto flex items-center gap-2 md:gap-3">
                <TitlebarUpdateButton update={update} />

                {canAccess(role, "/daily-close") && (
                    <Link
                        href="/daily-close"
                        className={cn(
                            "hidden h-6 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition sm:flex",
                            hasActiveShift
                                ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                : "bg-white/10 text-slate-300 hover:bg-white/15"
                        )}
                        title={hasActiveShift ? "Hay un turno de caja abierto" : "No hay turno de caja abierto"}
                    >
                        <span className={cn("size-2 rounded-full", hasActiveShift ? "bg-emerald-500" : "bg-slate-400")} />
                        {hasActiveShift ? "Caja abierta" : "Caja cerrada"}
                    </Link>
                )}

                <div className="hidden h-4 w-px bg-white/20 sm:block" />

                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger className="flex h-7 items-center gap-2 rounded-md px-1.5 outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-blue-500">
                        <div className="flex size-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
                            {initials || "U"}
                        </div>
                        <span className="hidden max-w-[160px] truncate text-xs font-medium text-white md:block">
                            {name} · <span className="text-slate-400">{ROLE_LABELS[(role || "").toUpperCase()] || role}</span>
                        </span>
                        <ChevronDown className="hidden size-3.5 text-slate-400 md:block" />
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
