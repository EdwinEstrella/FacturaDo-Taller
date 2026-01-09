'use server'

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"

// Get all users (Admin only)
export async function getUsers() {
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    try {
        const users = await db.user.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        })
        return { success: true, data: users }
    } catch (error) {
        return { success: false, error: "Error fetching users" }
    }
}

interface UserInput {
    name: string;
    username: string;
    password?: string;
    role: "ADMIN" | "SELLER" | "ACCOUNTANT";
}

// Create User
export async function createUser(data: UserInput) {
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    try {
        const existingUser = await db.user.findUnique({
            where: { username: data.username }
        })

        if (existingUser) {
            return { success: false, error: "El nombre de usuario ya existe" }
        }

        await db.user.create({
            data: {
                name: data.name,
                username: data.username,
                password: data.password || "123456", // Fallback or strict
                role: data.role
            }
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
            const existingUser = await db.user.findFirst({
                where: {
                    username: data.username,
                    NOT: { id }
                }
            })
            if (existingUser) {
                return { success: false, error: "El nombre de usuario ya existe" }
            }
        }

        await db.user.update({
            where: { id },
            data: {
                name: data.name,
                username: data.username,
                role: data.role,
                ...(data.password ? { password: data.password } : {}) // Only update password if provided
            }
        })

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

        await db.user.delete({
            where: { id }
        })

        revalidatePath("/settings/users")
        return { success: true }
    } catch {
        return { success: false, error: "Error al eliminar usuario" }
    }
}
