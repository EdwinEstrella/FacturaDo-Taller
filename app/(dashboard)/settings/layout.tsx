import { getCurrentUser } from "@/actions/auth-actions"
import { SettingsNav } from "@/components/modules/settings/settings-nav"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser()

    return (
        <div className="flex-1 space-y-6">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Ajustes</h2>
                <p className="text-sm text-muted-foreground">Configurá la empresa, los comprobantes fiscales y el acceso del equipo.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-8">
                <aside className="lg:sticky lg:top-0 lg:self-start">
                    <SettingsNav role={user?.role} />
                </aside>
                <div className="min-w-0">{children}</div>
            </div>
        </div>
    )
}
