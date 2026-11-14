// SERVER/WORKER ONLY. AES-256-GCM envelopes for fiscal certificate material.
//
// Envelope format (compatible with cyberbistro): "aes256gcm:<iv hex>:<tag hex>:<ciphertext hex>".
// The key comes from ECF_ENCRYPTION_KEY with the format "ecf-v1:<base64url of 32 bytes>".

import crypto from "node:crypto"
import { FiscalError } from "./errors"

const KEY_PATTERN = /^ecf-v1:([A-Za-z0-9_-]{43})$/
const ENVELOPE_PATTERN = /^aes256gcm:([0-9a-f]{24}):([0-9a-f]{32}):([0-9a-f]+)$/

export function parseEncryptionKey(rawKey: string | undefined): Buffer {
    const value = rawKey?.trim()
    if (!value) {
        throw new FiscalError("ENCRYPTION_KEY_MISSING", "ECF_ENCRYPTION_KEY is required to protect fiscal certificate material.")
    }
    const match = value.match(KEY_PATTERN)
    if (!match) {
        throw new FiscalError("ENCRYPTION_KEY_INVALID", "ECF_ENCRYPTION_KEY must use the ecf-v1:<base64url-32-byte-key> format.")
    }
    const key = Buffer.from(match[1], "base64url")
    if (key.byteLength !== 32 || key.every((byte) => byte === key[0])) {
        throw new FiscalError("ENCRYPTION_KEY_INVALID", "ECF_ENCRYPTION_KEY must contain 32 non-uniform cryptographic key bytes.")
    }
    return key
}

/** Generates a fresh key in the ecf-v1 format (used once to provision the server). */
export function generateEncryptionKey(): string {
    return `ecf-v1:${crypto.randomBytes(32).toString("base64url")}`
}

export function encryptBytes(data: Uint8Array, rawKey: string | undefined): string {
    const key = parseEncryptionKey(rawKey)
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()])
    const tag = cipher.getAuthTag()
    return `aes256gcm:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`
}

export function decryptBytes(envelope: string, rawKey: string | undefined): Buffer {
    const key = parseEncryptionKey(rawKey)
    const match = envelope?.match(ENVELOPE_PATTERN)
    if (!match) {
        // Plaintext is never accepted: a stored secret that is not an envelope is a defect.
        throw new FiscalError("ENVELOPE_INVALID", "Stored certificate material is not a valid aes256gcm envelope.")
    }
    try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(match[1], "hex"))
        decipher.setAuthTag(Buffer.from(match[2], "hex"))
        return Buffer.concat([decipher.update(Buffer.from(match[3], "hex")), decipher.final()])
    } catch {
        throw new FiscalError("DECRYPTION_FAILED", "Could not decrypt certificate material: wrong ECF_ENCRYPTION_KEY or corrupted data.")
    }
}

export function encryptText(text: string, rawKey: string | undefined): string {
    return encryptBytes(Buffer.from(text, "utf8"), rawKey)
}

export function decryptText(envelope: string, rawKey: string | undefined): string {
    return decryptBytes(envelope, rawKey).toString("utf8")
}
