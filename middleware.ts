import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { cookies } from "next/headers"

// Simple middleware to check for session cookie
export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname

    // Public paths
    if (path === "/login") {
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
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
}
