'use server'

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"
import { Database } from "@/lib/supabase/database.types"

type User = Database['public']['Tables']['User']['Row']
type UserInsert = Database['public']['Tables']['User']['Insert']
type UserUpdate = Database['public']['Tables']['User']['Update']

export async function getUsers() {
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    const supabase = await createClient()

    try {
        const { data: usersList, error } = await supabase
            .from('User')
            .select('*')
            .order('createdAt', { ascending: false })

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
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    const supabase = await createClient()

    try {
        // Check if username exists
        const { data: existingUser } = await supabase
            .from('User')
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
            role: data.role,
        }

        if (data.customPermissions) {
            userData.customPermissions = data.customPermissions
        }

        const { error } = await supabase
            .from('User')
            .insert(userData)

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
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    const supabase = await createClient()

    try {
        // Check username uniqueness if updating
        if (data.username) {
            const { data: existingUser } = await supabase
                .from('User')
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
            role: data.role,
        }

        if (data.password) {
            updateData.password = data.password
        }

        if (data.customPermissions) {
            updateData.customPermissions = data.customPermissions
        }

        const { error } = await supabase
            .from('User')
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
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    const supabase = await createClient()

    try {
        if (id === currentUser.id) {
            return { success: false, error: "No puedes eliminar tu propio usuario" }
        }

        const { error } = await supabase
            .from('User')
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
