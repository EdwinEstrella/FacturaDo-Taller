import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Proxy configuration for Next.js 16+
 * Anteriormente conocido como middleware.ts
 * Maneja la autenticación y redirección de rutas protegidas
 */

const RECEPTOR_PATH = /^\/\d{9}(?:\d{2})?\/fe\//

// Simple proxy to check for session cookie
export async function proxy(request: NextRequest) {
    const path = request.nextUrl.pathname

    // DGII inbound e-CF receptor (/{RNC}/fe/...): authenticated by its own bearer token, never by session.
    if (RECEPTOR_PATH.test(path)) {
        return NextResponse.next()
    }

    // The public receptor server (facturado.lat) exposes ONLY the receptor: no login, pages,
    // server actions or API routes. The desktop app never sets this flag.
    if (process.env.ECF_RECEPTOR_ONLY === "true") {
        return new NextResponse(null, { status: 404 })
    }

    // Public paths (API routes handle their own authentication)
    if (path === "/login" || path === "/api" || path.startsWith("/api/")) {
        return NextResponse.next()
    }

    // Check for session cookie
    const session = request.cookies.get("facturado_session_id")

    // If no session and trying to access protected route, redirect to login
    if (!session) {
        return NextResponse.redirect(new URL("/login", request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * API routes are matched so the receptor-only server can block them.
         */
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
}
