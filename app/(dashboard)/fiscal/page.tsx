import { redirect } from "next/navigation"

// Comprobantes fiscales ahora vive dentro de Ajustes.
export default function FiscalRedirect() {
    redirect("/settings/fiscal")
}
