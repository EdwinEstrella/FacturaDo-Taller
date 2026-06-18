import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from "@/lib/insforge/client"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
    const { username, password } = await request.json()

    const insforge = createServerClient()

    try {
        // Buscar usuario por username
        const { data: users, error: selectError } = await insforge.database
            .from('users')
            .select('*')
            .eq('username', username)
            .limit(1)

        if (selectError) {
            console.error("LOGIN ERROR:", selectError)
            return NextResponse.json({ success: false, error: 'Servicio de autenticaci?n no disponible' }, { status: 503 })
        }

        if (!users || users.length === 0) {
            return NextResponse.json({ success: false, error: 'Usuario o contraseña incorrectos' })
        }

        const user = users[0] as Record<string, unknown>

        // Verificar contraseña
        if (user.password !== password) {
            return NextResponse.json({ success: false, error: 'Usuario o contraseña incorrectos' })
        }

        // Crear cookie
        const cookieValue = user.id as string
        const response_with_cookie = NextResponse.json(
            { success: true, user: { id: user.id, name: user.name, username: user.username, role: user.role } },
            { status: 200 }
        )

        response_with_cookie.cookies.set('facturado_session_id', cookieValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: '/'
        })

        return response_with_cookie
    } catch (error) {
        console.error("LOGIN ERROR:", error)
        return NextResponse.json({ success: false, error: 'Error de servidor' }, { status: 500 })
    }
}
