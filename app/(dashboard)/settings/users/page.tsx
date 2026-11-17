import { getUsers } from "@/actions/user-actions"
import { getCurrentUser } from "@/actions/auth-actions"
import { UsersClient } from "./client"
import type { UsersClientUser } from "./client"

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
        role: user.role as UsersClientUser["role"],
        customPermissions: user.custom_permissions as Record<string, unknown> | null,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at)
    }))

    return <UsersClient initialUsers={convertedUsers} currentUserRole={currentUser?.role as UsersClientUser["role"]} />
}
