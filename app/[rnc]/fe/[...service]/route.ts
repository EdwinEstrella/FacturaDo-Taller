// Public DGII inbound services: https://facturado.lat/{RNC}/fe/{autenticacion|recepcion|aprobacioncomercial}/api/...
// No session: callers authenticate with the bearer token issued by /fe/autenticacion/api/validacioncertificado.
// proxy.ts lets these paths through without the login redirect.
import { handleEcfReceptor } from "@/lib/fiscal/receptor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
    return handleEcfReceptor(request)
}

export async function POST(request: Request): Promise<Response> {
    return handleEcfReceptor(request)
}
