"use server"

import { createServerClient } from "@/lib/insforge/client"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"

type User = {
  id: string
  name: string
  username: string
  password: string
  phone: string | null
  role: string
  custom_permissions: Record<string, unknown>
  created_at: string
  updated_at: string
}

const SESSION_COOKIE_NAME = "facturado_session_id"

// eslint-disable-next-line react-doctor/server-auth-actions
export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error(Unauthorized)
  }
  return user
}

export async function login(username: string, password: string) {
  console.log("LOGIN START: ", username)

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
      return { success: false, error: "Error al buscar usuario" }
    }

    if (!users || users.length === 0) {
      return { success: false, error: "Usuario o contraseña incorrectos" }
    }

    const user = users[0] as User

    // Verificar contraseña usando bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return { success: false, error: "Usuario o contraseña incorrectos" }
    }

    // Guardar ID de usuario en cookie
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/"
    })

    return { success: true, user: { id: user.id, name: user.name, username: user.username, role: user.role } }
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

  const insforge = createServerClient()

  try {
    const { data: users, error } = await insforge.database
      .from('users')
      .select('id, name, username, role')
      .eq('id', userId)
      .limit(1)

    if (error || !users || users.length === 0) {
      return null
    }

    return users[0]
  } catch {
    return null
  }
}

export async function registerUser(data: {
  username: string
  password: string
  name: string
  phone?: string
  role?: string
}) {
  const insforge = createServerClient()

  try {
    // Hashear la contraseña antes de guardarla
    const hashedPassword = await bcrypt.hash(data.password, 10)

    const { data: users, error } = await insforge.database
      .from('users')
      .insert([{
        username: data.username,
        password: hashedPassword,
        name: data.name,
        phone: data.phone || null,
        role: data.role || 'user'
      }])
      .select()

    if (error) {
      console.error("REGISTER ERROR:", error)
      return { success: false, error: "Error al registrar usuario" }
    }

    return { success: true, user: users?.[0] }
  } catch (error) {
    console.error("REGISTER ERROR:", error)
    return { success: false, error: "Error de servidor" }
  }
}