import { getUsers } from "@/actions/user-actions"
import { UsersClient } from "./client"

export default async function UsersPage() {
    const { success, data: users } = await getUsers()

    // Safety check if error or no users
    const safeUsers = success && users ? users : []

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h2>
            </div>
            <UsersClient initialUsers={safeUsers} />
        </div>
    )
}
