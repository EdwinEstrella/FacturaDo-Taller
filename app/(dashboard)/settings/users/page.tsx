import { getUsers } from "@/actions/user-actions"
import { getCurrentUser } from "@/actions/auth-actions"
import { UsersClient } from "./client"
import type { User } from "@/types"

export default async function UsersPage() {
    const [{ success, data: users }, currentUser] = await Promise.all([
        getUsers(),
        getCurrentUser()
    ])

    // Safety check if error or no users
    const safeUsers = success && users ? users : []

    // Convert to match component User interface
    const convertedUsers = safeUsers.map((user) => ({
        ...user,
        role: user.role as User["role"],
        customPermissions: user.customPermissions as Record<string, unknown> | null,
        createdAt: user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt),
        updatedAt: user.updatedAt instanceof Date ? user.updatedAt : new Date(user.updatedAt)
    }))

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h2>
            </div>
            <UsersClient initialUsers={convertedUsers} currentUserRole={currentUser?.role as User["role"]} />
        </div>
    )
}
