"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useMemo, useState, useEffect } from "react"
// Optimización: importar solo los iconos necesarios para tree-shaking
import {
    LayoutDashboard,
    BarChart3,
    Users,
    Package,
    Archive,
    Receipt,
    Briefcase,
    Truck,
    BookOpen,
    FileText,
    PieChart,
    PiggyBank,
    Wrench,
    LogOut
} from "lucide-react"

// Optimización: lucide-react ya tiene tree-shaking automático
// Solo importamos los iconos que usamos
const routes = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/", color: "text-sky-500" },
    { label: "Analíticas", icon: BarChart3, href: "/analytics", color: "text-pink-700" },
    { label: "Clientes", icon: Users, href: "/clients", color: "text-violet-500" },
    { label: "Productos / Stock", icon: Package, href: "/products", color: "text-emerald-500" },
    { label: "Almacén", icon: Archive, href: "/warehouse", color: "text-orange-500" },
    { label: "Facturación", icon: Receipt, href: "/invoices", color: "text-blue-600" },
    { label: "Pedidos / Producción", icon: Briefcase, href: "/orders", color: "text-purple-600" },
    { label: "Despacho / Conduce", icon: Truck, href: "/dispatch", color: "text-blue-700" },
    { label: "Módulo Técnico", icon: Wrench, href: "/technician", color: "text-orange-600" },
    { label: "Cuentas por Cobrar", icon: Receipt, href: "/receivables", color: "text-red-500" },
    { label: "Comprobantes Fiscales", icon: BookOpen, href: "/fiscal", color: "text-indigo-500" },
    { label: "Notas de Crédito", icon: FileText, href: "/credit-notes", color: "text-red-600" },
    { label: "Contabilidad / Cierre", icon: PieChart, href: "/accounting", color: "text-green-600" },
    { label: "Caja Chica", icon: PiggyBank, href: "/petty-cash", color: "text-pink-500" },
    { label: "Usuarios", icon: Users, href: "/settings/users", color: "text-gray-400" },
]

// Define User type interface if not available globally, or use any for now to unblock
interface UserProps {
    id: string
    name: string | null
    username: string
    role: "ADMIN" | "SELLER" | "ACCOUNTANT" | "TECHNICIAN" | "MANAGER" | "CUSTOM" | string
}

interface SidebarProps {
    user: UserProps | null
}

export function Sidebar({ user }: SidebarProps) {
    const pathname = usePathname()
    const [mounted, setMounted] = useState(false)
    const role = user?.role || "SELLER"

    // Prevent hydration mismatch by only rendering client-dependent content after mount
    useEffect(() => {
        setMounted(true)
    }, [])

    // Filter Routes based on Role - use useMemo to prevent recalculation
    const filteredRoutes = useMemo(() => {
        return routes.filter(route => {
            if (role === 'ADMIN') return true

            if (role === 'SELLER' || role === 'CUSTOM') {
                const blocked = ['/analytics', '/accounting', '/fiscal', '/petty-cash', '/settings/users', '/technician']
                return !blocked.includes(route.href)
            }

            if (role === 'ACCOUNTANT') {
                const blocked = ['/warehouse', '/products', '/settings/users', '/technician']
                return !blocked.includes(route.href)
            }

            if (role === 'TECHNICIAN') {
                const allowed = ['/technician']
                return allowed.includes(route.href)
            }

            if (role === 'MANAGER') {
                const blocked = ['/settings/users']
                return !blocked.includes(route.href)
            }

            return false
        })
    }, [role])

    if (!mounted) {
        // Return a skeleton/placeholder that matches the server render
        return (
            <div className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white">
                <div className="px-3 py-2 flex-1">
                    <Link href="/" className="flex items-center pl-3 mb-8">
                        <h1 className="text-2xl font-bold">Factura<span className="text-blue-500">DO</span></h1>
                    </Link>
                    <div className="mb-6 px-3">
                        <div className="h-4 w-24 bg-zinc-700 rounded animate-pulse mb-2"></div>
                        <div className="h-4 w-16 bg-zinc-700 rounded animate-pulse"></div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white">
            <div className="px-3 py-2 flex-1">
                <Link href="/" className="flex items-center pl-3 mb-8">
                    <h1 className="text-2xl font-bold">Factura<span className="text-blue-500">DO</span></h1>
                </Link>

                <div className="mb-6 px-3">
                    <p className="text-xs text-zinc-400 uppercase font-bold mb-1">
                        {user?.name || "Usuario"}
                    </p>
                    <p className="text-[10px] bg-blue-900 text-blue-200 px-2 py-0.5 rounded w-fit capitalize">
                        {role === 'SELLER' ? 'Ventas' :
                         (role === 'ACCOUNTANT' ? 'Contabilidad' :
                         (role === 'TECHNICIAN' ? 'Técnico' :
                         (role === 'MANAGER' ? 'Supervisor' :
                         (role === 'CUSTOM' ? 'Personalizado' : 'Administrador'))))}
                    </p>
                </div>

                <div className="space-y-1">
                    {filteredRoutes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            prefetch={pathname === route.href ? false : true}
                            className={cn(
                                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                                pathname === route.href ? "text-white bg-white/10" : "text-zinc-400"
                            )}
                        >
                            <div className="flex items-center flex-1">
                                <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                                {route.label}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="px-3 py-2">
                <button
                    onClick={async () => {
                        const { logout } = await import("@/actions/auth-actions")
                        await logout()
                    }}
                    className="text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition text-zinc-400"
                >
                    <div className="flex items-center flex-1">
                        <LogOut className="h-5 w-5 mr-3 text-red-500" />
                        Cerrar Sesión
                    </div>
                </button>
            </div>
        </div>
    )
}
