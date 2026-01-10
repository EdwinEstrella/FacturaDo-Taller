import LoginScreen from "@/components/ui/travel-connect-signin-1"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Iniciar Sesión | FacturaDO",
    description: "Inicia sesión en FacturaDO - Sistema de Facturación e Inventario",
}

export default function LoginPage() {
    return <LoginScreen />
}
