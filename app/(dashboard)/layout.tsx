import { getActiveShiftStatus } from "@/actions/cash-shift-actions"
import { getLicenseStatus } from "@/actions/license-actions"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { LicenseLockScreen } from "@/components/modules/license/license-lock-screen"

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [shiftStatus, license] = await Promise.all([
        getActiveShiftStatus(),
        getLicenseStatus(),
    ])

    if (license.state === "LOCKED") {
        return <LicenseLockScreen />
    }

    return (
        <DashboardShell
            user={shiftStatus.currentUser}
            hasActiveShift={shiftStatus.hasActiveShift}
            lastClosedShift={shiftStatus.lastClosedShift}
            license={license}
        >
            {children}
        </DashboardShell>
    )
}
