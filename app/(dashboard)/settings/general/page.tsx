import { getCompanySettings } from "@/actions/settings-actions"
import { SettingsGeneralClient } from "./client"

export default async function SettingsGeneralPage() {
    const settings = await getCompanySettings()
    return <SettingsGeneralClient initialSettings={settings} />
}
