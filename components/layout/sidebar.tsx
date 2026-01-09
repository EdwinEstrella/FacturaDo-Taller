"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    Users,
    Package,
    ShoppingCart,
    FileText,
    Truck,
    Receipt,
    PiggyBank,
    BarChart3,
    Settings,
    Archive,
    ClipboardList,
    BookOpen,
    StickyNote,
    PieChart,
    Briefcase,
    LogOut
} from "lucide-react"

const routes = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/", color: "text-sky-500" },
    { label: "Analíticas", icon: BarChart3, href: "/analytics", color: "text-pink-700" },
    { label: "Clientes", icon: Users, href: "/clients", color: "text-violet-500" },
    { label: "Productos / Stock", icon: Package, href: "/products", color: "text-emerald-500" },
    { label: "Almacén", icon: Archive, href: "/warehouse", color: "text-orange-500" },
    { label: "Facturación", icon: Receipt, href: "/invoices", color: "text-blue-600" },
    { label: "Pedidos / Producción", icon: Briefcase, href: "/orders", color: "text-purple-600" },
    { label: "Despacho / Conduce", icon: Truck, href: "/dispatch", color: "text-blue-700" },
    { label: "Cuentas por Cobrar", icon: Receipt, href: "/receivables", color: "text-red-500" },
    { label: "Comprobantes Fiscales", icon: BookOpen, href: "/fiscal", color: "text-indigo-500" },
    { label: "Contabilidad / Cierre", icon: PieChart, href: "/accounting", color: "text-green-600" },
    { label: "Caja Chica", icon: PiggyBank, href: "/petty-cash", color: "text-pink-500" },
    { label: "Usuarios", icon: Users, href: "/settings/users", color: "text-gray-400" },
]

import { getCurrentUser } from "@/actions/auth-actions"

export async function Sidebar() {
    const pathname = usePathname()
    const user = await getCurrentUser()
    const role = user?.role || "SELLER" // Default to strictest if not found (though middleware blocks)

    // Filter Routes based on Role
    // VENTA: Dashboard, Clients, Products, Warehouse, Invoices, Orders, Dispatch, Receivables?
    // User said: "vender, facturar, cotizar, crear productos"
    // "No tiene acceso a analsis, contabilidad"

    // ADMIN: All
    // ACCOUNTANT: Accounting, Fiscal, Receivables, etc.

    const filteredRoutes = routes.filter(route => {
        if (role === 'ADMIN') return true

        if (role === 'SELLER') {
            const blocked = ['/analytics', '/accounting', '/fiscal', '/petty-cash'] // Assuming Fiscal/PettyCash blocked too? Keep it safe.
            return !blocked.includes(route.href)
        }

        if (role === 'ACCOUNTANT') {
            // Accountant sees everything? Or mostly accounting/money stuff?
            // Usually Accountant needs invoices, fiscal, accounting, receivables. Maybe not Warehouse operations?
            // Let's allow all for Accountant except maybe dangerous settings if we ever add them.
            return true
        }

        return false
    })

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white">
            <div className="px-3 py-2 flex-1">
                <Link href="/" className="flex items-center pl-3 mb-8">
                    <h1 className="text-2xl font-bold">Factura<span className="text-blue-500">DO</span></h1>
                </Link>

                <div className="mb-6 px-3">
                    <p className="text-xs text-zinc-400 uppercase font-bold mb-1">
                        {user?.name}
                    </p>
                    <p className="text-[10px] bg-blue-900 text-blue-200 px-2 py-0.5 rounded w-fit capitalize">
                        {role === 'SELLER' ? 'Ventas' : (role === 'ACCOUNTANT' ? 'Contabilidad' : 'Administrador')}
                    </p>
                </div>

                <div className="space-y-1">
                    {filteredRoutes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
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
