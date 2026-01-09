"use server"

import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

const SESSION_COOKIE_NAME = "facturado_session_id"

export async function login(role: string, password: string) {
    // Simple auth logic as per user requirement.
    // In a real app, use bcrypt to verify hash.

    // Map Role Selection to DB User
    // For 'VENTA', we look for username 'venta'
    // For 'CONTADOR', we look for username 'contador'
    // For 'ADMIN', we look for username 'admin'
    // This is a simplification based on the prompt "los usuarios son ejemplo venta y contraseña 2025"

    let username = ""
    if (role === "VENTA") username = "venta"
    if (role === "CONTADOR") username = "contador"
    if (role === "ADMIN") username = "admin"

    const user = await prisma.user.findUnique({
        where: { username }
    })

    if (!user) {
        return { success: false, error: "Usuario no encontrado" }
    }

    // Check password (direct comparison for now as requested/seeded)
    if (user.password !== password) {
        return { success: false, error: "Contraseña incorrecta" }
    }

    // Create Session
    // For simplicity, we'll store the User ID in a cookie.
    // Ideally use a signed JWT or session table.
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/"
    })

    return { success: true }
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

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, username: true, role: true }
        })
        return user
    } catch (e) {
        return null
    }
}
