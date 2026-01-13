"use client";

import React, { useState, useEffect } from "react";
// Link is used in SubMenuItem
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Dashboard,
    Task,
    UserMultiple,
    Analytics,
    DocumentAdd,
    Settings as SettingsIcon,
    User as UserIcon,
    ChevronDown as ChevronDownIcon,
    Archive,
    View,
    Report,
    ChartBar,
    Share,
    Money,
    Box,
    Receipt,
    Catalog,
    Logout
} from "@carbon/icons-react";

// Softer spring animation curve
const softSpringEasing = "cubic-bezier(0.25, 1.1, 0.4, 1)";

/* ----------------------------- Brand / Logos ----------------------------- */

function InterfacesLogoSquare() {
    return (
        <div className="aspect-[24/24] grow min-h-px min-w-px overflow-clip relative shrink-0 flex items-center justify-center">
            <div className="font-bold text-xl text-black">F<span className="text-blue-600">D</span></div>
        </div>
    );
}

function BrandBadge() {
    return (
        <div className="relative shrink-0 w-full">
            <div className="flex items-center p-1 w-full">
                <div className="h-10 w-8 flex items-center justify-center pl-2">
                    <InterfacesLogoSquare />
                </div>
                <div className="px-2 py-1">
                    <div className="font-['Lexend:SemiBold',_sans-serif] text-[16px] text-neutral-900">
                        Factura<span className="text-blue-600">DO</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* --------------------------------- Avatar -------------------------------- */

interface UserProps {
    id: string
    name: string | null
    username: string
    role: "ADMIN" | "SELLER" | "ACCOUNTANT" | "TECHNICIAN" | "MANAGER" | "CUSTOM" | string
}

function AvatarCircle({ user }: { user: UserProps | null }) {
    return (
        <div className="relative rounded-full shrink-0 size-8 bg-blue-600">
            <div className="flex items-center justify-center size-8 text-white font-bold text-xs">
                {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
        </div>
    );
}

/* --------------------------- Types / Content Map -------------------------- */

interface MenuItemT {
    icon?: React.ReactNode;
    label: string;
    hasDropdown?: boolean;
    isActive?: boolean;
    children?: MenuItemT[];
    href?: string;
}
interface MenuSectionT {
    title: string;
    items: MenuItemT[];
}
interface SidebarContent {
    title: string;
    sections: MenuSectionT[];
}

// Helper to filter routes based on role (Client side check)
const checkRole = (role: string, href: string) => {
    if (role === 'ADMIN') return true
    if (role === 'SELLER' || role === 'CUSTOM') {
        const blocked = ['/analytics', '/accounting', '/liquidations', '/fiscal', '/settings/users', '/technician']
        return !blocked.includes(href)
    }
    if (role === 'ACCOUNTANT') {
        const blocked = ['/warehouse', '/products', '/settings/users', '/technician']
        return !blocked.includes(href)
    }
    if (role === 'TECHNICIAN') {
        return ['/technician'].includes(href)
    }
    if (role === 'MANAGER') {
        const blocked = ['/liquidations', '/settings/users']
        return !blocked.includes(href)
    }
    return false
}

function getSidebarContent(activeSection: string, role: string): SidebarContent {
    // Dashboard Content
    const dashboardContent: SidebarContent = {
        title: "Dashboard",
        sections: [
            {
                title: "General",
                items: [
                    { icon: <View size={16} className="text-neutral-900" />, label: "Vista General", href: "/" },
                    { icon: <Analytics size={16} className="text-neutral-900" />, label: "Analíticas", href: "/analytics" }
                ].filter(item => checkRole(role, item.href!))
            }
        ]
    }

    // Billing Content (Facturación)
    const billingContent: SidebarContent = {
        title: "Facturación",
        sections: [
            {
                title: "Ventas",
                items: [
                    { icon: <Receipt size={16} className="text-neutral-900" />, label: "Facturas", href: "/invoices" },
                    { icon: <DocumentAdd size={16} className="text-neutral-900" />, label: "Cotizaciones", href: "/quotes" },
                    { icon: <Receipt size={16} className="text-neutral-900" />, label: "Notas de Crédito", href: "/credit-notes" },
                    { icon: <Money size={16} className="text-neutral-900" />, label: "Cuentas por Cobrar", href: "/receivables" },
                ].filter(item => checkRole(role, item.href!))
            },
            {
                title: "Clientes",
                items: [
                    { icon: <UserMultiple size={16} className="text-neutral-900" />, label: "Directorio Clientes", href: "/clients" }
                ].filter(item => checkRole(role, item.href!))
            }
        ]
    }

    // Operations Content
    const operationsContent: SidebarContent = {
        title: "Operaciones",
        sections: [
            {
                title: "Inventario",
                items: [
                    { icon: <Catalog size={16} className="text-neutral-900" />, label: "Productos / Servicios", href: "/products" },
                    { icon: <Box size={16} className="text-neutral-900" />, label: "Almacén", href: "/warehouse" },
                ].filter(item => checkRole(role, item.href!))
            },
            {
                title: "Servicios",
                items: [
                    { icon: <Task size={16} className="text-neutral-900" />, label: "Pedidos / Producción", href: "/orders" },
                    { icon: <Share size={16} className="text-neutral-900" />, label: "Despacho", href: "/dispatch" },
                    { icon: <UserIcon size={16} className="text-neutral-900" />, label: "Técnicos", href: "/technician" },
                ].filter(item => checkRole(role, item.href!))
            }
        ]
    }

    // Finance Content
    const financeContent: SidebarContent = {
        title: "Finanzas",
        sections: [
            {
                title: "Contabilidad",
                items: [
                    { icon: <ChartBar size={16} className="text-neutral-900" />, label: "Contabilidad", href: "/accounting" },
                    { icon: <Money size={16} className="text-neutral-900" />, label: "Liquidaciones", href: "/liquidations" },
                    { icon: <Report size={16} className="text-neutral-900" />, label: "Comprobantes Fiscales", href: "/fiscal" },
                ].filter(item => checkRole(role, item.href!))
            },
            {
                title: "Caja",
                items: [
                    { icon: <Money size={16} className="text-neutral-900" />, label: "Caja Chica", href: "/petty-cash" },
                    { icon: <Archive size={16} className="text-neutral-900" />, label: "Cierre Diario", href: "/daily-close" },
                    { icon: <Archive size={16} className="text-neutral-900" />, label: "Historial de Cierre", href: "/cash-close-history" },
                ].filter(item => checkRole(role, item.href!))
            }
        ]
    }

    // Settings Content
    const settingsContent: SidebarContent = {
        title: "Configuración",
        sections: [
            {
                title: "Sistema",
                items: [
                    { icon: <SettingsIcon size={16} className="text-neutral-900" />, label: "General", href: "/settings/general" },
                    { icon: <UserMultiple size={16} className="text-neutral-900" />, label: "Usuarios", href: "/settings/users" },
                ].filter(item => checkRole(role, item.href!))
            }
        ]
    }

    // Empty default
    const empty: SidebarContent = { title: "", sections: [] }

    const map: Record<string, SidebarContent> = {
        dashboard: dashboardContent,
        billing: billingContent,
        operations: operationsContent,
        finance: financeContent,
        settings: settingsContent
    };

    return map[activeSection] || empty;
}

/* ---------------------------- Left Icon Nav Rail -------------------------- */

function IconNavButton({
    children,
    isActive = false,
    onClick,
    title
}: {
    children: React.ReactNode;
    isActive?: boolean;
    onClick?: () => void;
    title?: string;
}) {
    return (
        <button
            type="button"
            title={title}
            className={`flex items-center justify-center rounded-lg size-10 min-w-10 transition-colors duration-500
        ${isActive ? "bg-neutral-200 text-neutral-900" : "hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700"}`}
            style={{ transitionTimingFunction: softSpringEasing }}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function IconNavigation({
    activeSection,
    onSectionChange,
    user
}: {
    activeSection: string;
    onSectionChange: (section: string) => void;
    user: UserProps | null;
}) {
    const role = user?.role || "SELLER";

    const navItems = [
        { id: "dashboard", icon: <Dashboard size={20} />, label: "Dashboard" },
        { id: "billing", icon: <Receipt size={20} />, label: "Facturación" },
        { id: "operations", icon: <Box size={20} />, label: "Operaciones" },
        { id: "finance", icon: <Money size={20} />, label: "Finanzas" },
    ];

    let visibleNavItems = navItems;
    if (role !== 'ADMIN' && role !== 'MANAGER' && role !== 'ACCOUNTANT') {
        visibleNavItems = navItems.filter(i => i.id !== 'finance')
    }

    return (
        <aside className="bg-white flex flex-col gap-2 items-center p-4 w-16 h-full border-r border-neutral-200 z-[60]">
            {/* Logo */}
            <div className="mb-2 size-10 flex items-center justify-center">
                <InterfacesLogoSquare />
            </div>

            {/* Navigation Icons */}
            <div className="flex flex-col gap-2 w-full items-center">
                {visibleNavItems.map((item) => (
                    <IconNavButton
                        key={item.id}
                        title={item.label}
                        isActive={activeSection === item.id}
                        onClick={() => onSectionChange(item.id)}
                    >
                        {item.icon}
                    </IconNavButton>
                ))}
            </div>

            <div className="flex-1" />

            {/* Bottom section */}
            <div className="flex flex-col gap-2 w-full items-center">
                {(role === 'ADMIN' || role === 'MANAGER') && (
                    <IconNavButton isActive={activeSection === "settings"} onClick={() => onSectionChange("settings")} title="Configuración">
                        <SettingsIcon size={20} />
                    </IconNavButton>
                )}
                <div className="size-8" title={user?.name || "Usuario"}>
                    <AvatarCircle user={user} />
                </div>
            </div>
        </aside>
    );
}

/* ------------------------------ Right Sidebar ----------------------------- */

function SectionTitle({
    title,
    onToggleCollapse,
    isCollapsed,
}: {
    title: string;
    onToggleCollapse: () => void;
    isCollapsed: boolean;
}) {
    if (isCollapsed) {
        return (
            <div className="w-full flex justify-center transition-all duration-500" style={{ transitionTimingFunction: softSpringEasing }}>
                <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="flex items-center justify-center rounded-lg size-10 min-w-10 transition-all duration-500 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700"
                    style={{ transitionTimingFunction: softSpringEasing }}
                    aria-label="Expand sidebar"
                >
                    <span className="inline-block rotate-180">
                        <ChevronDownIcon size={16} />
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div className="w-full overflow-hidden transition-all duration-500" style={{ transitionTimingFunction: softSpringEasing }}>
            <div className="flex items-center justify-between">
                <div className="flex items-center h-10">
                    <div className="px-2 py-1">
                        <div className="font-['Lexend:SemiBold',_sans-serif] text-[18px] text-neutral-900 leading-[27px]">
                            {title}
                        </div>
                    </div>
                </div>
                <div className="pr-1">
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        className="flex items-center justify-center rounded-lg size-10 min-w-10 transition-all duration-500 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700"
                        style={{ transitionTimingFunction: softSpringEasing }}
                        aria-label="Collapse sidebar"
                    >
                        <ChevronDownIcon size={16} className="-rotate-90" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function DetailSidebar({ activeSection, user, onCollapseChange }: {
    activeSection: string;
    user: UserProps | null;
    onCollapseChange?: (collapsed: boolean) => void;
}) {
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const role = user?.role || "SELLER";
    const content = getSidebarContent(activeSection, role);

    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        onCollapseChange?.(isCollapsed);
    }, [isCollapsed, onCollapseChange]);


    const toggleExpanded = (itemKey: string) => {
        setExpandedItems((prev) => {
            const next = new Set(prev);
            if (next.has(itemKey)) next.delete(itemKey);
            else next.add(itemKey);
            return next;
        });
    };

    const toggleCollapse = () => setIsCollapsed((s) => !s);

    const router = useRouter();

    return (
        <aside
            className={`bg-white flex flex-col gap-4 items-start p-4 border-r border-neutral-200 transition-all duration-500 h-full ${isCollapsed ? "w-16 min-w-16 !px-0 justify-center" : "w-64"
                }`}
            style={{ transitionTimingFunction: softSpringEasing }}
        >
            {!isCollapsed && <BrandBadge />}

            <SectionTitle title={content.title} onToggleCollapse={toggleCollapse} isCollapsed={isCollapsed} />

            {/* Scrollable Content */}
            <div
                className={`flex flex-col w-full overflow-y-auto transition-all duration-500 flex-1 ${isCollapsed ? "gap-2 items-center" : "gap-4 items-start"
                    }`}
                style={{ transitionTimingFunction: softSpringEasing }}
            >
                {content.sections.map((section, index) => (
                    <MenuSection
                        key={`${activeSection}-${index}`}
                        section={section}
                        expandedItems={expandedItems}
                        onToggleExpanded={toggleExpanded}
                        isCollapsed={isCollapsed}
                    />
                ))}
            </div>

            {!isCollapsed && (
                <div className="w-full mt-auto pt-2 border-t border-neutral-200">
                    <div className="flex items-center gap-2 px-2 py-2">
                        <AvatarCircle user={user} />
                        <div className="flex flex-col">
                            <div className="font-['Lexend:Regular',_sans-serif] text-[14px] text-neutral-900 truncate max-w-[120px]">
                                {user?.name || "Usuario"}
                            </div>
                            <div className="text-[10px] text-neutral-500 capitalize">{user?.role?.toLowerCase()}</div>
                        </div>

                        <button
                            type="button"
                            onClick={async () => {
                                const { logout } = await import("@/actions/auth-actions")
                                await logout()
                                router.push("/login")
                            }}
                            className="ml-auto size-8 rounded-md flex items-center justify-center hover:bg-neutral-100 text-red-500"
                            aria-label="Cerrar Sesión"
                            title="Cerrar Sesión"
                        >
                            <Logout size={16} />
                        </button>
                    </div>
                </div>
            )}
        </aside>
    );
}

/* ------------------------------ Menu Elements ---------------------------- */

function MenuItem({
    item,
    isExpanded,
    onToggle,
    onItemClick,
    isCollapsed,
}: {
    item: MenuItemT;
    isExpanded?: boolean;
    onToggle?: () => void;
    onItemClick?: () => void;
    isCollapsed?: boolean;
}) {
    const pathname = usePathname();
    const isActive = item.href === pathname || (item.children?.some(c => c.href === pathname));
    const router = useRouter();

    const handleClick = () => {
        if (item.hasDropdown && onToggle) {
            onToggle();
        } else if (item.href) {
            onItemClick?.();
            router.push(item.href);
        }
    };

    return (
        <div
            className={`relative shrink-0 transition-all duration-500 ${isCollapsed ? "w-full flex justify-center" : "w-full"
                }`}
            style={{ transitionTimingFunction: softSpringEasing }}
        >
            <div
                className={`rounded-lg cursor-pointer transition-all duration-500 flex items-center relative ${isActive ? "bg-neutral-100 text-neutral-900" : "hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900"
                    } ${isCollapsed ? "w-10 min-w-10 h-10 justify-center p-4" : "w-full h-10 px-4 py-2"}`}
                style={{ transitionTimingFunction: softSpringEasing }}
                onClick={handleClick}
                title={isCollapsed ? item.label : undefined}
            >
                <div className={cn("flex items-center justify-center shrink-0", isActive ? "text-blue-600" : "")}>{item.icon}</div>

                <div
                    className={`flex-1 relative transition-opacity duration-500 overflow-hidden ${isCollapsed ? "opacity-0 w-0" : "opacity-100 ml-3"
                        }`}
                    style={{ transitionTimingFunction: softSpringEasing }}
                >
                    <div className="font-['Lexend:Regular',_sans-serif] text-[14px] leading-[20px] truncate">
                        {item.label}
                    </div>
                </div>

                {item.hasDropdown && (
                    <div
                        className={`flex items-center justify-center shrink-0 transition-opacity duration-500 ${isCollapsed ? "opacity-0 w-0" : "opacity-100 ml-2"
                            }`}
                        style={{ transitionTimingFunction: softSpringEasing }}
                    >
                        <ChevronDownIcon
                            size={16}
                            className="text-neutral-400 transition-transform duration-500"
                            style={{
                                transitionTimingFunction: softSpringEasing,
                                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function SubMenuItem({ item, onItemClick }: { item: MenuItemT; onItemClick?: () => void }) {
    const pathname = usePathname();
    const isActive = item.href === pathname;

    return (
        <Link href={item.href || "#"} className="w-full pl-9 pr-1 py-[1px] block" onClick={onItemClick}>
            <div
                className={cn(
                    "h-8 w-full rounded-lg cursor-pointer transition-colors flex items-center px-3 py-1",
                    isActive ? "bg-neutral-100 text-blue-600 font-medium" : "hover:bg-neutral-50 text-neutral-500"
                )}
            >
                <div className="flex-1 min-w-0">
                    <div className="font-['Lexend:Regular',_sans-serif] text-[13px] leading-[18px] truncate">
                        {item.label}
                    </div>
                </div>
            </div>
        </Link>
    );
}

function MenuSection({
    section,
    expandedItems,
    onToggleExpanded,
    isCollapsed,
}: {
    section: MenuSectionT;
    expandedItems: Set<string>;
    onToggleExpanded: (itemKey: string) => void;
    isCollapsed?: boolean;
}) {
    if (section.items.length === 0) return null;

    return (
        <div className="flex flex-col w-full">
            <div
                className={`relative shrink-0 w-full transition-all duration-500 overflow-hidden ${isCollapsed ? "h-0 opacity-0" : "h-10 opacity-100"
                    }`}
                style={{ transitionTimingFunction: softSpringEasing }}
            >
                <div className="flex items-center h-10 px-4">
                    <div className="font-['Lexend:Regular',_sans-serif] text-[12px] uppercase text-neutral-400 font-bold tracking-wider">
                        {section.title}
                    </div>
                </div>
            </div>

            {section.items.map((item, index) => {
                const itemKey = `${section.title}-${index}`;
                const isExpanded = expandedItems.has(itemKey);
                return (
                    <div key={itemKey} className="w-full flex flex-col">
                        <MenuItem
                            item={item}
                            isExpanded={isExpanded}
                            onToggle={() => onToggleExpanded(itemKey)}
                            onItemClick={() => { }}
                            isCollapsed={isCollapsed}
                        />
                        {isExpanded && item.children && !isCollapsed && (
                            <div className="flex flex-col gap-1 mb-2">
                                {item.children.map((child, childIndex) => (
                                    <SubMenuItem
                                        key={`${itemKey}-${childIndex}`}
                                        item={child}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}


/* ------------------------------- Root Frame ------------------------------ */

function getSectionFromPath(pathname: string) {
    if (pathname.includes("/invoices") || pathname.includes("/clients") || pathname.includes("/credit-notes") || pathname.includes("/receivables") || pathname.includes("/quotes")) {
        return "billing";
    } else if (pathname.includes("/products") || pathname.includes("/warehouse") || pathname.includes("/orders") || pathname.includes("/dispatch") || pathname.includes("/technician")) {
        return "operations";
    } else if (pathname.includes("/accounting") || pathname.includes("/liquidations") || pathname.includes("/fiscal") || pathname.includes("/petty-cash") || pathname.includes("/daily-close") || pathname.includes("/cash-close-history")) {
        return "finance";
    } else if (pathname.includes("/analytics")) {
        return "dashboard";
    } else if (pathname.includes("/settings")) {
        return "settings";
    } else {
        return "dashboard";
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AppSidebar({ user, isMobile }: { user: UserProps | null, isMobile?: boolean }) {
    const pathname = usePathname();
    const [activeSection, setActiveSection] = useState(() => getSectionFromPath(pathname));

    useEffect(() => {
        const newSection = getSectionFromPath(pathname);
        if (newSection !== activeSection) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveSection(newSection);
        }
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="flex flex-row h-screen bg-white text-black">
            <IconNavigation activeSection={activeSection} onSectionChange={setActiveSection} user={user} />
            <DetailSidebar activeSection={activeSection} user={user} onCollapseChange={() => { }} />
        </div>
    );
}
