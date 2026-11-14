import { getCurrentUser } from "@/actions/auth-actions"
import { getEcfSettingsState } from "@/actions/ecf-actions"
import { CertificateCard } from "@/components/modules/fiscal/certificate-card"
import { CertificationStepper } from "@/components/modules/fiscal/certification-stepper"
import { SettingsSection } from "@/components/modules/settings/settings-nav"

export default async function EcfSettingsPage() {
    const user = await getCurrentUser()
    if (String(user?.role).toUpperCase() !== "ADMIN") {
        return <p className="text-sm text-muted-foreground">Solo un administrador puede configurar la facturación electrónica.</p>
    }

    const state = await getEcfSettingsState()

    if (!state.schemaReady) {
        return (
            <SettingsSection
                title="Facturación electrónica"
                description="La base de datos todavía no tiene las tablas fiscales."
            >
                <p className="text-sm text-muted-foreground">
                    Falta aplicar las migraciones de facturación electrónica. Cuando estén aplicadas, aquí aparecerá el asistente de certificación.
                </p>
            </SettingsSection>
        )
    }

    return (
        <div className="space-y-6">
            <CertificateCard certificate={state.certificate} encryptionConfigured={state.encryptionConfigured} />
            <SettingsSection
                title="Certificación DGII"
                description="15 pasos para que la DGII autorice a tu empresa a emitir comprobantes fiscales electrónicos. Tu avance se guarda automáticamente."
            >
                <CertificationStepper initialProgress={state.progress} companyRnc={state.companyRnc} />
            </SettingsSection>
        </div>
    )
}
