import { getUsers } from "@/actions/user-actions"
import { UsersClient } from "@/components/modules/users/users-client"

export default async function UsersPage() {
    try {
        const users = await getUsers()
        return (
            <div className="p-8">
                <UsersClient users={users} />
            </div>
        )
    } catch (e) {
        return <div className="p-8 text-red-500">No tienes permisos para ver esta página.</div>
    }
}
