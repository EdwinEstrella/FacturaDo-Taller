import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    const { username, password } = await request.json()

    // Crear cliente de Supabase con SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Hacer request directamente a la API de Supabase
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/authenticate_user`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
            username_param: username,
            password_param: password
        })
    })

    const data = await response.json()

    if (!response.ok) {
        return NextResponse.json({ success: false, error: 'Error al autenticar' }, { status: response.status })
    }

    // La función retorna un array de usuarios directamente
    const userArray = data as any[]
    if (!userArray || userArray.length === 0) {
        return NextResponse.json({ success: false, error: 'Usuario o contraseña incorrectos' })
    }

    const user = userArray[0]

    // Crear cookie
    const cookieValue = user.id
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
}
