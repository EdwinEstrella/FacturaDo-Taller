'use server'


import { requireAuth } from "@/actions/auth-actions";
import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"

interface UserUpdate {
    name?: string | null
    username?: string
    phone?: string | null
    password?: string
    role?: string
    customPermissions?: Record<string, boolean> | null
}

export async function getUsers() {
    await requireAuth();

    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    const insforge = createServerClient()

    try {
        const { data: usersList, error } = await insforge.database
            .from('users')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            throw error
        }

        return { success: true, data: usersList || [] }
    } catch (error) {
        console.error(error)
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

export async function createUser(data: UserInput) {
    await requireAuth();

    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    const insforge = createServerClient()

    try {
        // Check if username exists
        const { data: existingUser } = await insforge.database
            .from('users')
            .select('id')
            .eq('username', data.username)
            .single()

        if (existingUser) {
            return { success: false, error: "El nombre de usuario ya existe" }
        }

        const userData: Record<string, unknown> = {
            name: data.name || "",
            username: data.username,
            phone: data.phone || null,
            password: data.password || "123456",
            role: data.role.toUpperCase(),
        }

        if (data.customPermissions) {
            userData.customPermissions = data.customPermissions
        }

        const { error } = await insforge.database
            .from('users')
            .insert([userData])

        if (error) {
            throw error
        }

        revalidatePath("/settings/users")
        return { success: true }
    } catch (error) {
        console.error("Create User Error:", error)
        return { success: false, error: "Error al crear usuario" }
    }
}

export async function updateUser(id: string, data: UserInput) {
    await requireAuth();

    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    const insforge = createServerClient()

    try {
        // Check username uniqueness if updating
        if (data.username) {
            const { data: existingUser } = await insforge.database
                .from('users')
                .select('id')
                .eq('username', data.username)
                .neq('id', id)
                .single()

            if (existingUser) {
                return { success: false, error: "El nombre de usuario ya existe" }
            }
        }

        const updateData: UserUpdate = {
            name: data.name || undefined,
            username: data.username,
            phone: data.phone,
            role: data.role.toUpperCase(),
        }

        if (data.password) {
            updateData.password = data.password
        }

        if (data.customPermissions) {
            updateData.customPermissions = data.customPermissions
        }

        const { error } = await insforge.database
            .from('users')
            .update(updateData)
            .eq('id', id)

        if (error) {
            throw error
        }

        revalidatePath("/settings/users")
        return { success: true }
    } catch (error) {
        console.error("Update User Error:", error)
        return { success: false, error: "Error al actualizar usuario" }
    }
}

export async function deleteUser(id: string) {
    await requireAuth();

    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    const insforge = createServerClient()

    try {
        if (id === currentUser.id) {
            return { success: false, error: "No puedes eliminar tu propio usuario" }
        }

        const { error } = await insforge.database
            .from('users')
            .delete()
            .eq('id', id)

        if (error) {
            throw error
        }

        revalidatePath("/settings/users")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Error al eliminar usuario" }
    }
}
