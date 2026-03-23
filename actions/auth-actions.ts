"use server"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

type User = {
    id: string
    name: string
    username: string
    phone: string | null
    role: string
    customPermissions: any
    createdAt: string
    updatedAt: string
}

const SESSION_COOKIE_NAME = "facturado_session_id"

export async function login(username: string, password: string) {
    console.log("LOGIN START: ", username)

    // Usar directamente el cliente de Supabase con SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const supabase = createSupabaseClient(
        supabaseUrl,
        supabaseServiceKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        }
    )

    try {
        const { data, error } = await supabase
            .rpc('authenticate_user', {
                username_param: username,
                password_param: password
            })

        if (error) {
            console.error("LOGIN ERROR:", error)
            return { success: false, error: "Error al autenticar" }
        }

        if (!data || data.length === 0) {
            return { success: false, error: "Usuario o contraseña incorrectos" }
        }

        // La función retorna un array de objetos JSON
        const user = Array.isArray(data) ? data[0] : data
        const userId = typeof user === 'object' && 'authenticate_user' in user
            ? user.authenticate_user.id
            : (user as any).id

        const cookieStore = await cookies()
        cookieStore.set(SESSION_COOKIE_NAME, userId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: "/"
        })

        return { success: true }
    } catch (error) {
        console.error("LOGIN ERROR:", error)
        return { success: false, error: "Error de servidor" }
    }
}

export async function logout() {
    const cookieStore = await cookies()
    cookieStore.delete(SESSION_COOKIE_NAME)
    redirect("/login")
}

export async function getCurrentUser() {
    const cookieStore = await cookies()
    const userId = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!userId) return null

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const supabase = createSupabaseClient(
        supabaseUrl,
        supabaseServiceKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        }
    )

    try {
        const { data: user, error } = await supabase
            .from('User')
            .select('id, name, username, role')
            .eq('id', userId)
            .single()

        if (error || !user) {
            return null
        }

        return user
    } catch {
        return null
    }
}
