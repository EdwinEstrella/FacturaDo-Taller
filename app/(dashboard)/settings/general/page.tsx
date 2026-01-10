import { getCompanySettings } from "@/actions/settings-actions"
import { SettingsGeneralClient } from "./client"

export default async function SettingsGeneralPage() {
    const settings = await getCompanySettings()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Configuración General</h2>
            </div>
            <SettingsGeneralClient initialSettings={settings} />
        </div>
    )
}
