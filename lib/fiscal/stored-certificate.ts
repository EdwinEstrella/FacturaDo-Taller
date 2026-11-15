// SERVER ONLY. Loads the stored certificate for the Next.js server. The app's anon key cannot read
// the encrypted columns (revoked on purpose), so this uses the server-side admin key, which must
// never reach the browser. Decryption needs ECF_ENCRYPTION_KEY.

import { decryptSigningMaterial, type CertificateRow, type EcfEnvironment, type SigningMaterial } from "./certificate-custody"
import { FiscalError } from "./errors"

export async function loadStoredSigningMaterial(environment: EcfEnvironment): Promise<SigningMaterial> {
    const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL
    const adminKey = process.env.INSFORGE_ADMIN_KEY
    if (!baseUrl || !adminKey) {
        throw new FiscalError("SERVER_NOT_CONFIGURED", "El servidor no tiene acceso para leer el certificado guardado.")
    }
    if (!process.env.ECF_ENCRYPTION_KEY?.trim()) {
        throw new FiscalError("ENCRYPTION_KEY_MISSING", "El servidor no tiene configurada la clave de cifrado fiscal (ECF_ENCRYPTION_KEY).")
    }

    const query = new URLSearchParams({
        select: "id,environment,p12Encrypted,passphraseEncrypted,isReady,validUntil",
        environment: `eq.${environment}`,
        limit: "1",
    })
    const response = await fetch(`${baseUrl}/api/database/records/EcfCertificateMetadata?${query}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
        cache: "no-store",
    })
    if (!response.ok) {
        throw new FiscalError("CERTIFICATE_LOOKUP_FAILED", "No se pudo consultar el certificado guardado.")
    }

    const rows = (await response.json()) as CertificateRow[]
    return decryptSigningMaterial(rows[0], process.env.ECF_ENCRYPTION_KEY)
}
