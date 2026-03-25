import { getCurrentUser } from "@/actions/auth-actions"
import { getInstallations, getPendingInstallationsCount } from "@/actions/installation-actions"
import { PendientesClient } from "./pendientes-client"

export default async function PendientesPage() {
    const installations = await getInstallations()
    const pendingCount = await getPendingInstallationsCount()
    const currentUser = await getCurrentUser()

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
