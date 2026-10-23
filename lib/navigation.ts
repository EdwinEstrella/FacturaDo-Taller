import {
    BarChart3,
    Calculator,
    ClipboardCheck,
    FileMinus,
    FileSignature,
    FileText,
    History,
    LayoutDashboard,
    Landmark,
    Package,
    Receipt,
    ScrollText,
    Settings,
    ShoppingBag,
    Truck,
    UserCog,
    Users,
    Wallet,
    Vault,
    Wrench,
    type LucideIcon,
} from "lucide-react"

export interface NavItem {
    label: string
    href: string
    icon: LucideIcon
}

export interface NavSection {
    title: string
    items: NavItem[]
}

/* Única definición del menú. El breadcrumb de la barra superior sale de aquí también. */
export const NAV_SECTIONS: NavSection[] = [
    {
        title: "General",
        items: [
            { label: "Panel", href: "/", icon: LayoutDashboard },
            { label: "Analíticas", href: "/analytics", icon: BarChart3 },
        ],
    },
    {
        title: "Ventas",
        items: [
            { label: "Facturas", href: "/invoices", icon: Receipt },
            { label: "Cotizaciones", href: "/quotes", icon: FileSignature },
            { label: "Notas de Crédito", href: "/credit-notes", icon: FileMinus },
            { label: "Cuentas por Cobrar", href: "/receivables", icon: Landmark },
            { label: "Clientes", href: "/clients", icon: Users },
        ],
    },
    {
        title: "Taller",
        items: [
            { label: "Desglose P65", href: "/desglose/ventana-p65", icon: Calculator },
            { label: "Desglose Tradicional", href: "/desglose/ventana-tradicional", icon: Calculator },
            { label: "Historial de Desgloses", href: "/desglose/historial", icon: ScrollText },
            { label: "Instalaciones", href: "/pendientes", icon: ClipboardCheck },
            { label: "Despacho", href: "/dispatch", icon: Truck },
        ],
    },
    {
        title: "Inventario",
        items: [
            { label: "Productos y Servicios", href: "/products", icon: Package },
            { label: "Compras", href: "/liquidations", icon: ShoppingBag },
        ],
    },
    {
        title: "Caja",
        items: [
            { label: "Cierre de Caja", href: "/daily-close", icon: Vault },
            { label: "Historial de Cierres", href: "/cash-close-history", icon: History },
            { label: "Caja Chica", href: "/petty-cash", icon: Wallet },
        ],
    },
    {
        title: "Administración",
        items: [
            { label: "Comprobantes Fiscales", href: "/fiscal", icon: FileText },
            { label: "Usuarios", href: "/settings/users", icon: UserCog },
            { label: "Configuración", href: "/settings/general", icon: Settings },
        ],
    },
]

const TECHNICIAN_SECTIONS: NavSection[] = [
    { title: "Mi trabajo", items: [{ label: "Mis Despachos", href: "/technician", icon: Wrench }] },
]

const BLOCKED_BY_ROLE: Record<string, string[]> = {
    SELLER: ["/analytics", "/liquidations", "/fiscal", "/petty-cash", "/daily-close", "/cash-close-history", "/settings/users", "/settings/general"],
    CUSTOM: ["/analytics", "/liquidations", "/fiscal", "/petty-cash", "/daily-close", "/cash-close-history", "/settings/users", "/settings/general"],
    ACCOUNTANT: ["/products", "/settings/users", "/settings/general"],
    MANAGER: ["/liquidations", "/settings/users"],
}

export function canAccess(role: string | undefined, href: string) {
    const r = (role || "SELLER").toUpperCase()
    if (r === "ADMIN") return true
    if (r === "TECHNICIAN") return href === "/technician"
    const blocked = BLOCKED_BY_ROLE[r]
    return blocked ? !blocked.includes(href) : false
}

export function getNavSections(role: string | undefined): NavSection[] {
    if ((role || "").toUpperCase() === "TECHNICIAN") return TECHNICIAN_SECTIONS
    return NAV_SECTIONS
        .map((s) => ({ ...s, items: s.items.filter((i) => canAccess(role, i.href)) }))
        .filter((s) => s.items.length > 0)
}

export function isActivePath(pathname: string | null, href: string) {
    if (!pathname) return false
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
}

/** Sección y página actuales, para el breadcrumb. */
export function findNavItem(pathname: string | null): { section: string; item: NavItem } | null {
    const all = [...NAV_SECTIONS, ...TECHNICIAN_SECTIONS]
    let best: { section: string; item: NavItem } | null = null
    for (const s of all) {
        for (const i of s.items) {
            if (isActivePath(pathname, i.href) && (!best || i.href.length > best.item.href.length)) {
                best = { section: s.title, item: i }
            }
        }
    }
    return best
}
