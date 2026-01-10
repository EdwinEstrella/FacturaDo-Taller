import { getCurrentUser } from "@/actions/auth-actions"
import { DashboardShell } from "@/components/layout/dashboard-shell"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Optimización: fetch del usuario una sola vez
    const user = await getCurrentUser()

    return (
        <DashboardShell user={user}>
            {children}
        </DashboardShell>
    )
}
