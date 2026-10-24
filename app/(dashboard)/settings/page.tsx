import { redirect } from "next/navigation"
import { getCurrentUser } from "@/actions/auth-actions"
import { SETTINGS_TABS } from "@/components/modules/settings/settings-nav"
import { canAccess } from "@/lib/navigation"

export default async function SettingsIndex() {
    const user = await getCurrentUser()
    const first = SETTINGS_TABS.find((t) => canAccess(user?.role, t.href))
    redirect(first?.href || "/")
}
