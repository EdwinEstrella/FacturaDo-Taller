import { getActiveShiftStatus } from "@/actions/cash-shift-actions"
import { DashboardShell } from "@/components/layout/dashboard-shell"

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const shiftStatus = await getActiveShiftStatus()

    return (
        <DashboardShell
            user={shiftStatus.currentUser}
            hasActiveShift={shiftStatus.hasActiveShift}
            lastClosedShift={shiftStatus.lastClosedShift}
        >
            {children}
        </DashboardShell>
    )
}
