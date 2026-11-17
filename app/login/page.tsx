import LoginScreen from "@/components/ui/travel-connect-signin-1"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Iniciar Sesión | FacturaDO",
    description: "Inicia sesión en FacturaDO - Sistema de Facturación e Inventario",
}

export default function LoginPage() {
    return (
        <>
            {/* The desktop window has no native title bar: this strip lets the user drag it. */}
            <div aria-hidden className="titlebar-drag fixed inset-x-0 top-0 z-50 h-9" />
            <LoginScreen />
        </>
    )
}
