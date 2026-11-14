"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldCheck, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { uploadEcfCertificate, type EcfCertificateSummary } from "@/actions/ecf-actions"
import { SettingsSection } from "@/components/modules/settings/settings-nav"

function formatDate(value: string) {
    return new Date(value).toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" })
}

export function CertificateCard({ certificate, encryptionConfigured }: {
    certificate: EcfCertificateSummary | null
    encryptionConfigured: boolean
}) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [fileName, setFileName] = useState("")
    const [passphrase, setPassphrase] = useState("")
    const [error, setError] = useState("")
    const [pending, startTransition] = useTransition()

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError("")
        const formData = new FormData(event.currentTarget)
        startTransition(async () => {
            const result = await uploadEcfCertificate(formData)
            if (!result.success) {
                setError(result.error)
                return
            }
            toast.success("Certificado validado y guardado")
            formRef.current?.reset()
            setFileName("")
            setPassphrase("")
            router.refresh()
        })
    }

    return (
        <SettingsSection
            title="Certificado digital"
            description="Sube tu certificado .p12 y escribe su contraseña. Se valida y se guarda cifrado en el servidor; el archivo nunca vuelve al navegador."
        >
            {certificate?.isReady && (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0" />
                    <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold">Certificado listo</p>
                        <p className="break-words text-xs">{certificate.subject}</p>
                        <p className="text-xs">Vence el {formatDate(certificate.validUntil)}</p>
                    </div>
                </div>
            )}

            {!encryptionConfigured && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    El servidor no tiene configurada la variable <span className="font-mono">ECF_ENCRYPTION_KEY</span>. Sin ella no se puede guardar el certificado.
                </p>
            )}

            <form ref={formRef} onSubmit={submit} className="max-w-md space-y-4">
                <div className="space-y-2">
                    <label htmlFor="ecf-certificate-file" className="text-sm font-medium">
                        {certificate?.isReady ? "Reemplazar certificado (.p12)" : "Archivo del certificado (.p12)"}
                    </label>
                    <Input
                        id="ecf-certificate-file"
                        name="certificate"
                        type="file"
                        accept=".p12,.pfx"
                        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="ecf-certificate-passphrase" className="text-sm font-medium">Contraseña del certificado</label>
                    <Input
                        id="ecf-certificate-passphrase"
                        name="passphrase"
                        type="password"
                        autoComplete="off"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                    />
                </div>
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                <Button type="submit" disabled={pending || !fileName || !passphrase || !encryptionConfigured}>
                    {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                    Validar y guardar
                </Button>
            </form>
        </SettingsSection>
    )
}
