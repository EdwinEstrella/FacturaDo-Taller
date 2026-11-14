// SERVER/WORKER ONLY. Validates an uploaded .p12 and prepares it for custody, and loads
// signing material for the fiscal worker. The database only ever receives AES-256-GCM
// envelopes; the key lives in ECF_ENCRYPTION_KEY on the server.

import forge from "node-forge"
import P12Reader from "../ecf/P12Reader"
import { decryptBytes, decryptText, encryptBytes, encryptText } from "./crypto"
import { FiscalError } from "./errors"

export type EcfEnvironment = "test" | "certification" | "production"

export interface CertificateMetadata {
    subject: string
    issuer: string
    serialNumber: string
    validFrom: Date
    validUntil: Date
}

export interface PreparedCertificate {
    metadata: CertificateMetadata
    p12Encrypted: string
    passphraseEncrypted: string
}

export interface SigningMaterial {
    certificateId: string
    environment: EcfEnvironment
    /** PEM private key and certificate, ready for lib/ecf Signature. */
    key: string
    cert: string
    validUntil: Date
}

export interface Queryable {
    query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }>
}

const WRONG_PASSWORD_PATTERN = /mac could not be verified|invalid password|passphrase|password/i

function formatDistinguishedName(attributes: forge.pki.CertificateField[]): string {
    return attributes
        .map((attribute) => {
            const label = attribute.shortName || attribute.name || attribute.type
            return label && attribute.value ? `${label}=${attribute.value}` : null
        })
        .filter((part): part is string => part !== null)
        .join(", ")
}

/**
 * Validates the .p12 (file + passphrase + validity window) and returns the metadata plus the
 * encrypted envelopes to persist. Throws FiscalError with a user-presentable, secret-free message.
 */
export function prepareCertificateForStorage(input: {
    p12Bytes: Uint8Array
    passphrase: string
    encryptionKey: string | undefined
    now?: Date
}): PreparedCertificate {
    if (!input.p12Bytes.byteLength) {
        throw new FiscalError("CERTIFICATE_BYTES_REQUIRED", "Selecciona el archivo del certificado .p12.")
    }
    if (!input.passphrase) {
        throw new FiscalError("CERTIFICATE_PASSPHRASE_REQUIRED", "Escribe la contraseña del certificado.")
    }

    let pem: string | undefined
    try {
        pem = new P12Reader(input.passphrase).getKeyFromStringBase64(Buffer.from(input.p12Bytes).toString("base64")).cert
    } catch (error) {
        // Never echo parser details: they may include file internals. Classify only.
        const text = error instanceof Error ? error.message : ""
        if (WRONG_PASSWORD_PATTERN.test(text)) {
            throw new FiscalError("WRONG_PASSWORD", "La contraseña del certificado es incorrecta.")
        }
        throw new FiscalError("INVALID_FILE", "El archivo no es un certificado .p12 válido.")
    }
    if (!pem) {
        throw new FiscalError("INVALID_FILE", "El archivo no es un certificado .p12 válido.")
    }

    const certificate = forge.pki.certificateFromPem(pem)
    const metadata: CertificateMetadata = {
        subject: formatDistinguishedName(certificate.subject.attributes),
        issuer: formatDistinguishedName(certificate.issuer.attributes),
        serialNumber: certificate.serialNumber,
        validFrom: certificate.validity.notBefore,
        validUntil: certificate.validity.notAfter,
    }

    const now = input.now ?? new Date()
    if (!metadata.subject) {
        throw new FiscalError("INVALID_FILE", "El archivo no es un certificado .p12 válido.")
    }
    if (metadata.validFrom.getTime() > now.getTime()) {
        throw new FiscalError("CERTIFICATE_NOT_VALID_YET", "El certificado digital todavía no está vigente.")
    }
    if (metadata.validUntil.getTime() <= now.getTime()) {
        throw new FiscalError("CERTIFICATE_EXPIRED", "El certificado digital se encuentra vencido.")
    }

    return {
        metadata,
        p12Encrypted: encryptBytes(input.p12Bytes, input.encryptionKey),
        passphraseEncrypted: encryptText(input.passphrase, input.encryptionKey),
    }
}

interface CertificateRow {
    id: string
    environment: EcfEnvironment
    p12Encrypted: string
    passphraseEncrypted: string
    isReady: boolean
    validUntil: Date | string
}

/** Loads and decrypts the ready certificate for an environment (worker side, direct DB access). */
export async function loadSigningMaterial(
    db: Queryable,
    environment: EcfEnvironment,
    encryptionKey: string | undefined,
    now: Date = new Date()
): Promise<SigningMaterial> {
    const result = await db.query<CertificateRow>(
        `SELECT id, environment, "p12Encrypted", "passphraseEncrypted", "isReady", "validUntil"
         FROM public."EcfCertificateMetadata"
         WHERE environment = $1`,
        [environment]
    )

    const row = result.rows[0]
    if (!row || !row.isReady) {
        throw new FiscalError("CERTIFICATE_NOT_FOUND", "No hay un certificado digital listo para este ambiente.")
    }

    const validUntil = new Date(row.validUntil)
    if (validUntil.getTime() <= now.getTime()) {
        throw new FiscalError("CERTIFICATE_EXPIRED", "El certificado digital se encuentra vencido.")
    }

    const passphrase = decryptText(row.passphraseEncrypted, encryptionKey)
    const p12Base64 = decryptBytes(row.p12Encrypted, encryptionKey).toString("base64")

    let material: { key?: string; cert?: string }
    try {
        material = new P12Reader(passphrase).getKeyFromStringBase64(p12Base64)
    } catch {
        throw new FiscalError("CERTIFICATE_UNREADABLE", "No se pudo leer el certificado almacenado.")
    }
    if (!material.key || !material.cert) {
        throw new FiscalError("CERTIFICATE_UNREADABLE", "No se pudo leer el certificado almacenado.")
    }

    return {
        certificateId: row.id,
        environment: row.environment,
        key: material.key,
        cert: material.cert,
        validUntil,
    }
}
