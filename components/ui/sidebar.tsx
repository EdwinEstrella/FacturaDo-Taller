"use client";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge"
import {
  Blocks,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  UserCircle,
  UserCog,
  LineChart,
  Receipt,
  FilePlus,
  CircleDollarSign,
  Users,
  PackageSearch,
  Package,
  ClipboardList,
  Truck,
  Send,
  User,
  BarChart,
  FileText,
  Archive,
  Menu,
  HelpCircle
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

interface UserProps {
  id: string
  name: string | null
  username: string
  role: "ADMIN" | "SELLER" | "ACCOUNTANT" | "TECHNICIAN" | "MANAGER" | "CUSTOM" | string
}

const sidebarVariants = {
  open: {
    width: "15rem",
  },
  closed: {
    width: "3.05rem",
  },
};

const contentVariants = {
  open: { display: "block", opacity: 1 },
  closed: { display: "block", opacity: 1 },
};

const variants = {
  open: {
    x: 0,
    opacity: 1,
    transition: {
      x: { stiffness: 1000, velocity: -100 },
    },
  },
  closed: {
    x: -20,
    opacity: 0,
    transition: {
      x: { stiffness: 100 },
    },
  },
};

const transitionProps: import("framer-motion").Transition = {
  type: "tween",
  ease: "easeOut",
  duration: 0.2,
  staggerChildren: 0.1,
};

const staggerVariants = {
  open: {
    transition: { staggerChildren: 0.03, delayChildren: 0.02 },
  },
};

const checkRole = (role: string, href: string) => {
  const normalizedRole = role.toUpperCase()
  if (normalizedRole === 'ADMIN') return true
  if (normalizedRole === 'SELLER' || normalizedRole === 'CUSTOM') {
      const blocked = ['/analytics', '/accounting', '/liquidations', '/fiscal', '/petty-cash', '/daily-close', '/cash-close-history', '/settings/users', '/technician']
      return !blocked.includes(href)
  }
  if (normalizedRole === 'ACCOUNTANT') {
      const blocked = ['/warehouse', '/products', '/settings/users', '/technician']
      return !blocked.includes(href)
  }
  if (normalizedRole === 'TECHNICIAN') {
      return ['/technician'].includes(href)
  }
  if (normalizedRole === 'MANAGER') {
      const blocked = ['/liquidations', '/settings/users']
      return !blocked.includes(href)
  }
  return false
}

export function SessionNavBar({ user }: { user?: UserProps | null }) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  
  const role = user?.role || "SELLER";

  const navSections = [
    {
        title: "Dashboard",
        items: [
            { icon: LayoutDashboard, label: "Vista General", href: "/" },
            { icon: LineChart, label: "Analíticas", href: "/analytics" }
        ].filter(item => checkRole(role, item.href))
    },
    {
        title: "Facturación",
        items: [
            { icon: Receipt, label: "Facturas", href: "/invoices" },
            { icon: FilePlus, label: "Cotizaciones", href: "/quotes" },
            { icon: Receipt, label: "Notas de Crédito", href: "/credit-notes" },
            { icon: CircleDollarSign, label: "Cuentas por Cobrar", href: "/receivables" },
            { icon: Users, label: "Directorio Clientes", href: "/clients" }
        ].filter(item => checkRole(role, item.href))
    },
    {
        title: "Operaciones",
        items: [
            { icon: PackageSearch, label: "Productos / Servicios", href: "/products" },
            { icon: Package, label: "Almacén", href: "/warehouse" },
            { icon: ClipboardList, label: "Pedidos / Producción", href: "/orders" },
            { icon: Truck, label: "Pendientes", href: "/pendientes" },
            { icon: Send, label: "Despacho", href: "/dispatch" },
            { icon: User, label: "Técnicos", href: "/technician" },
        ].filter(item => checkRole(role, item.href))
    },
    {
        title: "Finanzas",
        items: [
            { icon: BarChart, label: "Contabilidad", href: "/accounting" },
            { icon: CircleDollarSign, label: "Liquidaciones", href: "/liquidations" },
            { icon: FileText, label: "Fiscales", href: "/fiscal" },
            { icon: CircleDollarSign, label: "Caja Chica", href: "/petty-cash" },
            { icon: Archive, label: "Cierre Diario", href: "/daily-close" },
            { icon: Archive, label: "Historial de Cierre", href: "/cash-close-history" },
        ].filter(item => checkRole(role, item.href))
    },
    {
        title: "Desglose",
        items: [
            { icon: LayoutDashboard, label: "Ventana P65", href: "/desglose/ventana-p65" },
            { icon: PackageSearch, label: "Ventana Tradicional", href: "/desglose/ventana-tradicional" },
            { icon: FileText, label: "Historial", href: "/desglose/historial" },
        ].filter(item => checkRole(role, item.href))
    }
  ].filter(section => section.items.length > 0);

  return (
    <motion.div
      className={cn(
        "sidebar z-40 h-full shrink-0 border-r",
      )}
      initial={isCollapsed ? "closed" : "open"}
      animate={isCollapsed ? "closed" : "open"}
      variants={sidebarVariants}
      transition={transitionProps}
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
    >
      <motion.div
        className={`relative z-40 flex text-muted-foreground h-full shrink-0 flex-col bg-white dark:bg-black transition-all`}
        variants={contentVariants}
      >
        <motion.div variants={staggerVariants} className="flex h-full flex-col">
          <div className="flex grow flex-col items-center overflow-hidden">
            <div className="flex h-[54px] w-full shrink-0 border-b p-2">
              <div className="mt-[1.5px] flex w-full">
                <Button
                    variant="ghost"
                    size="sm"
                    className="flex w-fit items-center gap-2 px-2 hover:bg-transparent cursor-default" 
                >
                    <div className="flex items-center justify-center size-6 bg-blue-600 rounded text-white font-bold text-xs shrink-0">
                        FD
                    </div>
                    <motion.div
                        variants={variants}
                        className="flex w-fit items-center gap-2"
                    >
                        {!isCollapsed && (
                            <p className="text-sm font-semibold text-black dark:text-white">
                                Factura<span className="text-blue-600">DO</span>
                            </p>
                        )}
                    </motion.div>
                </Button>
              </div>
            </div>

            <div className="flex h-full w-full flex-col overflow-hidden">
              <div className="flex grow flex-col gap-4 overflow-hidden">
                <ScrollArea className="h-full grow p-2">
                  <div className={cn("flex w-full flex-col gap-1")}>
                    {navSections.map((section, idx) => (
                        <div key={idx} className="mb-2 w-full">
                            {!isCollapsed && (
                                <motion.div variants={variants} className="px-2 py-1.5 mt-2">
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                        {section.title}
                                    </p>
                                </motion.div>
                            )}
                            {isCollapsed && idx !== 0 && (
                                <div className="py-2 flex justify-center w-full">
                                    <Separator className="w-4" />
                                </div>
                            )}
                            
                            {section.items.map((item, itemIdx) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href || (pathname?.startsWith(item.href) && item.href !== "/");
                                return (
                                    <Link
                                        key={itemIdx}
                                        href={item.href}
                                        className={cn(
                                            "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition-colors mt-1",
                                            isActive 
                                                ? "bg-neutral-100 text-blue-600 font-medium" 
                                                : "hover:bg-neutral-50 hover:text-neutral-900"
                                        )}
                                        title={isCollapsed ? item.label : undefined}
                                    >
                                        <Icon className="h-4 w-4 shrink-0" />
                                        <motion.div variants={variants} className="overflow-hidden">
                                            {!isCollapsed && (
                                                <p className="ml-2 text-[13px] whitespace-nowrap">{item.label}</p>
                                            )}
                                        </motion.div>
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <div className="flex flex-col p-2 shrink-0 border-t">
                {(role.toUpperCase() === 'ADMIN' || role.toUpperCase() === 'MANAGER') && (
                    <>
                        <Link
                            href="/settings/general"
                            className="mt-1 flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-neutral-50 hover:text-neutral-900"
                            title={isCollapsed ? "Configuración" : undefined}
                        >
                            <Settings className="h-4 w-4 shrink-0" />
                            <motion.div variants={variants} className="overflow-hidden">
                                {!isCollapsed && (
                                    <p className="ml-2 text-[13px]">Configuración</p>
                                )}
                            </motion.div>
                        </Link>
                        <Link
                            href="/settings/users"
                            className="flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-neutral-50 hover:text-neutral-900"
                            title={isCollapsed ? "Usuarios" : undefined}
                        >
                            <UserCog className="h-4 w-4 shrink-0" />
                            <motion.div variants={variants} className="overflow-hidden">
                                {!isCollapsed && (
                                    <p className="ml-2 text-[13px]">Usuarios</p>
                                )}
                            </motion.div>
                        </Link>
                    </>
                )}
                <div className="mt-2">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger className="w-full">
                      <div className="flex h-8 w-full flex-row items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-neutral-50 hover:text-neutral-900">
                        <div className="flex items-center justify-center size-5 bg-blue-600 rounded-full text-white font-bold text-[10px] shrink-0">
                            {user?.name?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <motion.div
                          variants={variants}
                          className="flex w-full items-center gap-2 overflow-hidden"
                        >
                          {!isCollapsed && (
                            <>
                              <p className="text-[13px] font-medium whitespace-nowrap">{user?.name || "Usuario"}</p>
                              <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground/50 shrink-0" />
                            </>
                          )}
                        </motion.div>
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent sideOffset={5} align="start" className="w-[200px]">
                      <div className="flex flex-row items-center gap-2 p-2">
                        <div className="flex items-center justify-center size-8 bg-blue-600 rounded-full text-white font-bold text-xs shrink-0">
                            {user?.name?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div className="flex flex-col text-left overflow-hidden">
                          <span className="text-sm font-medium truncate">
                            {user?.name || "Usuario"}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {user?.role?.toLowerCase() || "Seller"}
                          </span>
                        </div>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 focus:text-red-700 focus:bg-red-50"
                        onClick={async () => {
                            const { logout } = await import("@/actions/auth-actions")
                            await logout()
                            router.push("/login")
                        }}
                      >
                        <LogOut className="h-4 w-4" /> Cerrar Sesión
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
