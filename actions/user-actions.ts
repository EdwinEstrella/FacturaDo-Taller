'use server'

import { db } from "@/lib/db"
import { users } from "@/db/schema"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"
import { eq, desc, ne, and } from "drizzle-orm"

// Get all users (Admin only)
export async function getUsers() {
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    try {
        const usersList = await db.select().from(users).orderBy(desc(users.createdAt))
        return { success: true, data: usersList }
    } catch {
        return { success: false, error: "Error fetching users" }
    }
}

interface UserInput {
    name: string | null;
    username: string;
    phone?: string | null;
    password?: string;
    role: "ADMIN" | "SELLER" | "ACCOUNTANT" | "TECHNICIAN" | "MANAGER" | "CUSTOM";
    customPermissions?: Record<string, boolean> | null;
}

// Create User
export async function createUser(data: UserInput) {
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    try {
        const [existingUser] = await db.select().from(users).where(eq(users.username, data.username)).limit(1)

        if (existingUser) {
            return { success: false, error: "El nombre de usuario ya existe" }
        }

        await db.insert(users).values({
            name: data.name || "",
            username: data.username,
            phone: data.phone || null,
            password: data.password || "123456",
            role: data.role,
            ...(data.customPermissions && { customPermissions: data.customPermissions })
        })

        revalidatePath("/settings/users")
        return { success: true }
    } catch (error) {
        console.error("Create User Error:", error)
        return { success: false, error: "Error al crear usuario" }
    }
}

// Update User
export async function updateUser(id: string, data: UserInput) {
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    try {
        // If updating username, check for uniqueness
        if (data.username) {
            const [existingUser] = await db.select().from(users).where(
                and(
                    eq(users.username, data.username),
                    ne(users.id, id)
                )
            ).limit(1)

            if (existingUser) {
                return { success: false, error: "El nombre de usuario ya existe" }
            }
        }

        await db.update(users)
            .set({
                name: data.name || undefined,
                username: data.username,
                phone: data.phone,
                role: data.role,
                ...(data.password ? { password: data.password } : {}),
                ...(data.customPermissions && { customPermissions: data.customPermissions })
            })
            .where(eq(users.id, id))

        revalidatePath("/settings/users")
        return { success: true }
    } catch (error) {
        console.error("Update User Error:", error)
        return { success: false, error: "Error al actualizar usuario" }
    }
}

// Delete User
export async function deleteUser(id: string) {
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    try {
        if (id === currentUser.id) {
            return { success: false, error: "No puedes eliminar tu propio usuario" }
        }

        await db.delete(users).where(eq(users.id, id))

        revalidatePath("/settings/users")
        return { success: true }
    } catch {
        return { success: false, error: "Error al eliminar usuario" }
    }
}
