"use server"

import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/actions/auth-actions"
import { createServerClient } from "@/lib/insforge/client"
import { prepareCertificateForStorage } from "@/lib/fiscal/certificate-custody"
import { FiscalError } from "@/lib/fiscal/errors"
import { signXmlWithMaterial } from "@/lib/fiscal/sign-document"
import { loadStoredSigningMaterial } from "@/lib/fiscal/stored-certificate"
import {
    CERTIFICATION_TOTAL_STEPS,
    INITIAL_CERTIFICATION_PROGRESS,
    restoreProgress,
    type CertificationProgress,
} from "@/lib/fiscal/shared/certification-steps"

const MAX_CERTIFICATE_BYTES = 1024 * 1024

export interface EcfCertificateSummary {
    subject: string
    issuer: string
    validUntil: string
    isReady: boolean
}

export interface EcfSettingsState {
    /** False when the e-CF migrations have not been applied to the database yet. */
    schemaReady: boolean
    progress: CertificationProgress
    certificate: EcfCertificateSummary | null
    companyRnc: string
    encryptionConfigured: boolean
}

export type EcfActionResult = { success: true } | { success: false; error: string }

async function requireAdmin() {
    const user = await getCurrentUser()
    if (!user || String(user.role).toUpperCase() !== "ADMIN") {
        throw new Error("Solo un administrador puede configurar la facturación electrónica.")
    }
    return user
}

export async function getEcfSettingsState(): Promise<EcfSettingsState> {
    await requireAdmin()
    const insforge = createServerClient()

    const [progressResult, certificateResult, settingResult] = await Promise.all([
        insforge.database.from("EcfCertificationProgress").select("currentStep, completedSteps").limit(1),
        insforge.database
            .from("EcfCertificateMetadata")
            .select("subject, issuer, validUntil, isReady")
            .eq("environment", "test")
            .limit(1),
        insforge.database.from("Setting").select("value").eq("key", "COMPANY_RNC").limit(1),
    ])

    const schemaReady = !progressResult.error && !certificateResult.error

    return {
        schemaReady,
        progress: schemaReady ? restoreProgress(progressResult.data?.[0]) : INITIAL_CERTIFICATION_PROGRESS,
        certificate: (certificateResult.data?.[0] as EcfCertificateSummary | undefined) ?? null,
        companyRnc: String(settingResult.data?.[0]?.value ?? ""),
        encryptionConfigured: Boolean(process.env.ECF_ENCRYPTION_KEY?.trim()),
    }
}

export async function saveCertificationProgress(progress: CertificationProgress): Promise<EcfActionResult> {
    const user = await requireAdmin()
    const normalized = restoreProgress(progress)
    if (normalized.currentStep < 1 || normalized.currentStep > CERTIFICATION_TOTAL_STEPS) {
        return { success: false, error: "Paso de certificación inválido." }
    }

    const insforge = createServerClient()
    const { error } = await insforge.database.rpc("save_ecf_certification_progress", {
        p_current_step: normalized.currentStep,
        p_completed_steps: normalized.completedSteps,
        p_updated_by: user.username ?? null,
    })

    if (error) {
        console.error("save_ecf_certification_progress failed:", error)
        return { success: false, error: "No se pudo guardar el avance de la certificación." }
    }

    revalidatePath("/settings/ecf")
    return { success: true }
}

export type SignXmlResult = { success: true; signedXml: string } | { success: false; error: string }

const MAX_XML_BYTES = 2 * 1024 * 1024

/** Signs an uploaded XML with the certificate already stored in the system. */
export async function signXmlDocument(formData: FormData): Promise<SignXmlResult> {
    await requireAdmin()

    const xmlFile = formData.get("xml")
    if (!(xmlFile instanceof File) || xmlFile.size === 0) {
        return { success: false, error: "Selecciona el archivo XML que vas a firmar." }
    }
    if (xmlFile.size > MAX_XML_BYTES) {
        return { success: false, error: "El archivo XML es demasiado grande." }
    }

    try {
        const { key, cert } = await loadStoredSigningMaterial("test")
        const signedXml = signXmlWithMaterial({ xml: await xmlFile.text(), key, cert })
        return { success: true, signedXml }
    } catch (error) {
        if (error instanceof FiscalError) {
            if (error.code === "CERTIFICATE_NOT_FOUND") {
                return { success: false, error: "Primero sube tu certificado digital en la sección «Certificado digital» de esta página." }
            }
            const userFacing = new Set(["XML_REQUIRED", "SIGNING_FAILED", "CERTIFICATE_EXPIRED", "ENCRYPTION_KEY_MISSING"])
            if (userFacing.has(error.code)) return { success: false, error: error.message }
            console.error("XML signing custody error:", error.code)
            return { success: false, error: "No se pudo leer el certificado guardado. Revisa la configuración del servidor." }
        }
        console.error("XML signing error:", error)
        return { success: false, error: "No se pudo firmar el documento." }
    }
}

export async function uploadEcfCertificate(formData: FormData): Promise<EcfActionResult> {
    await requireAdmin()

    const file = formData.get("certificate")
    const passphrase = String(formData.get("passphrase") ?? "")

    if (!(file instanceof File) || file.size === 0) {
        return { success: false, error: "Selecciona el archivo del certificado .p12." }
    }
    if (file.size > MAX_CERTIFICATE_BYTES) {
        return { success: false, error: "El archivo es demasiado grande para ser un certificado .p12." }
    }
    if (!process.env.ECF_ENCRYPTION_KEY?.trim()) {
        return { success: false, error: "El servidor no tiene configurada la clave de cifrado fiscal (ECF_ENCRYPTION_KEY)." }
    }

    try {
        const prepared = prepareCertificateForStorage({
            p12Bytes: new Uint8Array(await file.arrayBuffer()),
            passphrase,
            encryptionKey: process.env.ECF_ENCRYPTION_KEY,
        })

        const insforge = createServerClient()
        const { error } = await insforge.database.rpc("store_ecf_certificate", {
            p_subject: prepared.metadata.subject,
            p_issuer: prepared.metadata.issuer,
            p_serial_number: prepared.metadata.serialNumber,
            p_valid_from: prepared.metadata.validFrom.toISOString(),
            p_valid_until: prepared.metadata.validUntil.toISOString(),
            p_p12_encrypted: prepared.p12Encrypted,
            p_passphrase_encrypted: prepared.passphraseEncrypted,
        })

        if (error) {
            console.error("store_ecf_certificate failed:", error)
            return { success: false, error: "No se pudo guardar el certificado." }
        }

        revalidatePath("/settings/ecf")
        return { success: true }
    } catch (error) {
        if (error instanceof FiscalError) {
            const userFacing = new Set([
                "WRONG_PASSWORD",
                "INVALID_FILE",
                "CERTIFICATE_EXPIRED",
                "CERTIFICATE_NOT_VALID_YET",
                "CERTIFICATE_BYTES_REQUIRED",
                "CERTIFICATE_PASSPHRASE_REQUIRED",
            ])
            if (userFacing.has(error.code)) return { success: false, error: error.message }
            console.error("Certificate custody error:", error.code)
            return { success: false, error: "No se pudo proteger el certificado. Revisa la configuración del servidor." }
        }
        console.error("Certificate upload error:", error)
        return { success: false, error: "No se pudo procesar el certificado." }
    }
}
