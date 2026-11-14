import { Building2, FileBadge2, FileText, UserCog } from "lucide-react"

// Sin "use client": lo importan tanto componentes de servidor (page.tsx) como el menú cliente.
export const SETTINGS_TABS = [
    { href: "/settings/general", label: "Empresa", description: "Datos, logo, factura e impresoras", icon: Building2 },
    { href: "/settings/fiscal", label: "Comprobantes fiscales", description: "Secuencias NCF", icon: FileText },
    { href: "/settings/ecf", label: "Facturación electrónica", description: "Certificado y certificación DGII", icon: FileBadge2 },
    { href: "/settings/users", label: "Usuarios", description: "Accesos y roles del equipo", icon: UserCog },
]
