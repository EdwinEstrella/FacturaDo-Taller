"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useMemo, useState, useEffect } from "react"
// Optimización: importar solo los iconos necesarios
import {
    LayoutDashboard,
    Users,
    Package,
    Archive,
    Receipt,
    Briefcase,
    Truck,
    BookOpen, // Invoice/Fiscal
    FileText,
    PieChart,
    PiggyBank,
    Wrench,
    LogOut,
    Settings,
    Hammer,
    ChevronDown,
    ChevronRight,
} from "lucide-react"

// Definir tipo para las rutas
type Route = {
    label: string
    icon: any
    href?: string
    color?: string
    children?: Route[]
}

const routes: Route[] = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/", color: "text-sky-500" },
    { label: "Clientes", icon: Users, href: "/clients", color: "text-violet-500" },
    { label: "Productos / Stock", icon: Package, href: "/products", color: "text-emerald-500" },
    { label: "Almacén", icon: Archive, href: "/warehouse", color: "text-orange-500" },
    { label: "Facturación", icon: Receipt, href: "/invoices", color: "text-blue-600" },
    {
        label: "Taller",
        icon: Hammer,
        color: "text-orange-600",
        children: [
            { label: "Pedidos / Producción", icon: Briefcase, href: "/orders", color: "text-purple-600" },
            { label: "Despacho / Conduce", icon: Truck, href: "/dispatch", color: "text-blue-700" },
        ]
    },
    { label: "Módulo Técnico", icon: Wrench, href: "/technician", color: "text-orange-600" },
    { label: "Cuentas por Cobrar", icon: Receipt, href: "/receivables", color: "text-red-500" },
    { label: "Notas de Crédito", icon: FileText, href: "/credit-notes", color: "text-red-600" },
    { label: "Contabilidad / Cierre", icon: PieChart, href: "/accounting", color: "text-green-600" },
    { label: "Caja Chica", icon: PiggyBank, href: "/petty-cash", color: "text-pink-500" },
    {
        label: "Configuración",
        icon: Settings,
        color: "text-gray-400",
        children: [
            { label: "Usuarios", icon: Users, href: "/settings/users", color: "text-gray-400" },
            { label: "Comprobantes Fiscales", icon: BookOpen, href: "/fiscal", color: "text-indigo-500" },
        ]
    },
]

interface UserProps {
    id: string
    name: string | null
    username: string
    role: "ADMIN" | "SELLER" | "ACCOUNTANT" | "TECHNICIAN" | "MANAGER" | "CUSTOM" | string
}

interface SidebarProps {
    user: UserProps | null
    isCollapsed?: boolean
    setIsCollapsed?: (collapsed: boolean) => void
    isMobile?: boolean
}

export function Sidebar({ user, isCollapsed, setIsCollapsed, isMobile }: SidebarProps) {
    const pathname = usePathname()
    const [mounted, setMounted] = useState(false)
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({}) // Track open submenus
    const role = user?.role || "SELLER"

    useEffect(() => {
        setMounted(true)
    }, [])

    // Initialize open groups based on active route
    useEffect(() => {
        if (!mounted) return

        const newOpenGroups = { ...openGroups }
        routes.forEach(route => {
            if (route.children) {
                const isActive = route.children.some(child => child.href === pathname)
                if (isActive) {
                    newOpenGroups[route.label] = true
                }
            }
        })
        setOpenGroups(prev => ({ ...prev, ...newOpenGroups }))
    }, [pathname, mounted])

    const toggleGroup = (label: string) => {
        if (isCollapsed && setIsCollapsed) {
            setIsCollapsed(false) // Auto-expand sidebar if clicking a group (mostly for tooltip/icon click)
            // Short delay to allow expansion then toggle
            setTimeout(() => {
                setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
            }, 50)
            return
        }
        setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
    }

    // Filter Routes based on Role
    const filteredRoutes = useMemo(() => {
        const checkRole = (role: string, href: string) => {
            if (role === 'ADMIN') return true

            if (role === 'SELLER' || role === 'CUSTOM') {
                const blocked = ['/analytics', '/accounting', '/fiscal', '/petty-cash', '/settings/users', '/technician']
                return !blocked.includes(href)
            }

            if (role === 'ACCOUNTANT') {
                const blocked = ['/warehouse', '/products', '/settings/users', '/technician']
                return !blocked.includes(href)
            }

            if (role === 'TECHNICIAN') {
                const allowed = ['/technician']
                return allowed.includes(href)
            }

            if (role === 'MANAGER') {
                const blocked = ['/settings/users']
                return !blocked.includes(href)
            }

            return false
        }

        return routes.map(route => {
            if (route.children) {
                const visibleChildren = route.children.filter(child => checkRole(role, child.href || ''))
                if (visibleChildren.length > 0) {
                    return { ...route, children: visibleChildren }
                }
                return null
            }
            if (checkRole(role, route.href || '')) return route
            return null
        }).filter(Boolean) as Route[]
    }, [role])

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white relative">
            {/* Minimize Button - only show on desktop if not explicitly mobile */}
            {!isMobile && (
                <button
                    onClick={() => setIsCollapsed?.(!isCollapsed)}
                    className={cn(
                        "absolute -right-3 top-20 bg-white border border-gray-200 text-gray-900 rounded-full p-1 shadow-md hover:bg-gray-100 transition-colors z-50 hidden md:flex items-center justify-center h-6 w-6 transform",
                        isCollapsed ? "rotate-180" : "rotate-0"
                    )}
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    <div className="w-0 h-0 border-t-[4px] border-t-transparent border-r-[6px] border-r-gray-900 border-b-[4px] border-b-transparent" />
                </button>
            )}

            <div className="px-3 py-2 flex-1 overflow-y-auto">
                <Link href="/" className={cn("flex items-center pl-3 mb-8 transition-all", isCollapsed ? "justify-center pl-0" : "")}>
                    {isCollapsed ? (
                        <h1 className="text-2xl font-bold text-blue-500">F<span className="text-white">D</span></h1>
                    ) : (
                        <h1 className="text-2xl font-bold">Factura<span className="text-blue-500">DO</span></h1>
                    )}
                </Link>

                <div className={cn("mb-6 px-3 transition-all", isCollapsed ? "px-0 flex justify-center" : "")}>
                    {!mounted ? (
                        isCollapsed ? (
                            <div className="h-8 w-8 bg-zinc-700 rounded-full animate-pulse"></div>
                        ) : (
                            <>
                                <div className="h-4 w-24 bg-zinc-700 rounded animate-pulse mb-2"></div>
                                <div className="h-4 w-16 bg-zinc-700 rounded animate-pulse"></div>
                            </>
                        )
                    ) : (
                        isCollapsed ? (
                            <div className="h-8 w-8 rounded-full bg-blue-900 text-blue-200 flex items-center justify-center font-bold text-xs" title={user?.name || "Usuario"}>
                                {user?.name?.charAt(0).toUpperCase() || "U"}
                            </div>
                        ) : (
                            <>
                                <p className="text-xs text-zinc-400 uppercase font-bold mb-1 truncate">
                                    {user?.name || "Usuario"}
                                </p>
                                <p className="text-[10px] bg-blue-900 text-blue-200 px-2 py-0.5 rounded w-fit capitalize">
                                    {role === 'SELLER' ? 'Ventas' :
                                        (role === 'ACCOUNTANT' ? 'Contabilidad' :
                                            (role === 'TECHNICIAN' ? 'Técnico' :
                                                (role === 'MANAGER' ? 'Supervisor' :
                                                    (role === 'CUSTOM' ? 'Personalizado' : 'Administrador'))))}
                                </p>
                            </>
                        )
                    )}
                </div>

                <div className="space-y-1">
                    {mounted && filteredRoutes.map((route) => {
                        // Render Submenu
                        if (route.children) {
                            return (
                                <div key={route.label} className="mb-1">
                                    <button
                                        onClick={() => toggleGroup(route.label)}
                                        className={cn(
                                            "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition items-center w-full",
                                            isCollapsed ? "justify-center px-2" : "",
                                            openGroups[route.label] ? "bg-white/5" : ""
                                        )}
                                        title={isCollapsed ? route.label : undefined}
                                    >
                                        <div className={cn("flex items-center flex-1", isCollapsed ? "justify-center" : "")}>
                                            <route.icon className={cn("h-5 w-5", route.color, isCollapsed ? "mr-0" : "mr-3")} />
                                            {!isCollapsed && (
                                                <>
                                                    <span className="flex-1 text-left">{route.label}</span>
                                                    {openGroups[route.label] ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
                                                </>
                                            )}
                                        </div>
                                    </button>

                                    {/* Submenu Children */}
                                    {!isCollapsed && openGroups[route.label] && (
                                        <div className="ml-4 pl-4 border-l border-gray-700 mt-1 space-y-1">
                                            {route.children.map(child => (
                                                <Link
                                                    key={child.href}
                                                    href={child.href!}
                                                    prefetch={pathname === child.href ? false : true}
                                                    className={cn(
                                                        "text-sm group flex p-2 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                                                        pathname === child.href ? "text-white bg-white/10" : "text-zinc-400"
                                                    )}
                                                >
                                                    <div className="flex items-center flex-1">
                                                        <child.icon className={cn("h-4 w-4 mr-2", child.color)} />
                                                        {child.label}
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        }

                        // Render Item
                        return (
                            <Link
                                key={route.href}
                                href={route.href!}
                                prefetch={pathname === route.href ? false : true}
                                className={cn(
                                    "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                                    pathname === route.href ? "text-white bg-white/10" : "text-zinc-400",
                                    isCollapsed ? "justify-center px-2" : ""
                                )}
                                title={isCollapsed ? route.label : undefined}
                            >
                                <div className={cn("flex items-center flex-1", isCollapsed ? "justify-center" : "")}>
                                    <route.icon className={cn("h-5 w-5", route.color, isCollapsed ? "mr-0" : "mr-3")} />
                                    {!isCollapsed && route.label}
                                </div>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {mounted && (
                <div className={cn("px-3 py-2", isCollapsed ? "px-2" : "")}>
                    <button
                        onClick={async () => {
                            const { logout } = await import("@/actions/auth-actions")
                            await logout()
                        }}
                        className={cn(
                            "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition text-zinc-400",
                            isCollapsed ? "justify-center px-2" : ""
                        )}
                        title={isCollapsed ? "Cerrar Sesión" : undefined}
                    >
                        <div className={cn("flex items-center flex-1", isCollapsed ? "justify-center" : "")}>
                            <LogOut className={cn("h-5 w-5 text-red-500", isCollapsed ? "mr-0" : "mr-3")} />
                            {!isCollapsed && "Cerrar Sesión"}
                        </div>
                    </button>
                </div>
            )}
        </div>
    )
}
