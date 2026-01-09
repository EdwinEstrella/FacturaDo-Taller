"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "./auth-actions"
import { revalidatePath } from "next/cache"
import { Role } from "@prisma/client"

export async function getUsers() {
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }
    return prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
    })
}

export async function createUser(data: { name: string, username: string, password: string, role: Role }) {
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        return { success: false, error: "Unauthorized" }
    }

    try {
        await prisma.user.create({
            data
        })
        revalidatePath('/settings/users')
        return { success: true }
    } catch (e) {
        return { success: false, error: "Error creating user (Username might be taken)" }
    }
}

export async function deleteUser(userId: string) {
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'ADMIN') {
        return { success: false, error: "Unauthorized" }
    }

    // Prevent self-deletion
    if (currentUser.id === userId) {
        return { success: false, error: "Cannot delete yourself" }
    }

    try {
        await prisma.user.delete({
            where: { id: userId }
        })
        revalidatePath('/settings/users')
        return { success: true }
    } catch (e) {
        return { success: false, error: "Error deleting user" }
    }
}
