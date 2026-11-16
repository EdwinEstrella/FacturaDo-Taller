// SERVER ONLY. Loads the stored certificate for the Next.js server. The app's anon key cannot read
// the encrypted columns (revoked on purpose), so this uses the server-side admin key, which must
// never reach the browser. Decryption needs ECF_ENCRYPTION_KEY.

import { createFiscalAdminClient } from "./admin-client"
import { decryptSigningMaterial, type CertificateRow, type EcfEnvironment, type SigningMaterial } from "./certificate-custody"
import { FiscalError } from "./errors"

export async function loadStoredSigningMaterial(environment: EcfEnvironment): Promise<SigningMaterial> {
    let client: ReturnType<typeof createFiscalAdminClient>
    try {
        client = createFiscalAdminClient()
    } catch {
        throw new FiscalError("SERVER_NOT_CONFIGURED", "El servidor no tiene acceso para leer el certificado guardado.")
    }
    if (!process.env.ECF_ENCRYPTION_KEY?.trim()) {
        throw new FiscalError("ENCRYPTION_KEY_MISSING", "El servidor no tiene configurada la clave de cifrado fiscal (ECF_ENCRYPTION_KEY).")
    }

    const { data: rows, error } = await client.database
        .from("EcfCertificateMetadata")
        .select("id,environment,p12Encrypted,passphraseEncrypted,isReady,validUntil")
        .eq("environment", environment)
        .limit(1)

    if (error || !rows) {
        throw new FiscalError("CERTIFICATE_LOOKUP_FAILED", "No se pudo consultar el certificado guardado.")
    }

    return decryptSigningMaterial(rows[0] as CertificateRow | undefined, process.env.ECF_ENCRYPTION_KEY)
}
