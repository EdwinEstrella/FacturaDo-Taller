"use server"

import { db } from "@/lib/db"
import { users } from "@/db/schema"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"

const SESSION_COOKIE_NAME = "facturado_session_id"

export async function login(username: string, password: string) {
    console.log("LOGIN START: ", username)
    try {
        const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1)

        if (!user) {
            return { success: false, error: "Usuario no encontrado" }
        }

        if (user.password !== password) {
            return { success: false, error: "Contraseña incorrecta" }
        }

        const cookieStore = await cookies()
        cookieStore.set(SESSION_COOKIE_NAME, user.id, {
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

    try {
        const [user] = await db.select({
            id: users.id,
            name: users.name,
            username: users.username,
            role: users.role
        }).from(users).where(eq(users.id, userId)).limit(1)

        return user
    } catch {
        return null
    }
}
