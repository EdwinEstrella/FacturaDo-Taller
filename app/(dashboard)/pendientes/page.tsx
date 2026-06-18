import { getCurrentUser } from "@/actions/auth-actions"
import { getInstallations, getPendingInstallationsCount } from "@/actions/installation-actions"
import { PendientesClient } from "./pendientes-client"

export default async function PendientesPage() {
    const [installations, pendingCount, currentUser] = await Promise.all([
        getInstallations(),
        getPendingInstallationsCount(),
        getCurrentUser()
    ])

    return (
        <div className="space-y-6 p-8">
            <PendientesClient
                installations={installations}
                pendingCount={pendingCount}
                currentUser={currentUser}
            />
        </div>
    )
}
