// SERVER ONLY. Signs an arbitrary DGII XML document (e.g. the registration/postulation file)
// with a .p12 supplied for this single operation. Nothing is persisted.

import Signature from "../ecf/Signature/Signature"
import { readP12Material } from "./certificate-custody"
import { FiscalError } from "./errors"

export function signXmlWithP12(input: { xml: string; p12Bytes: Uint8Array; passphrase: string }): string {
    if (!input.xml.trim()) {
        throw new FiscalError("XML_REQUIRED", "Selecciona el archivo XML que vas a firmar.")
    }
    if (!input.p12Bytes.byteLength) {
        throw new FiscalError("CERTIFICATE_BYTES_REQUIRED", "Selecciona el archivo del certificado .p12.")
    }
    if (!input.passphrase) {
        throw new FiscalError("CERTIFICATE_PASSPHRASE_REQUIRED", "Escribe la contraseña del certificado.")
    }

    const { key, cert } = readP12Material(input.p12Bytes, input.passphrase)

    try {
        return new Signature(key, cert).signXml(input.xml)
    } catch (error) {
        const detail = error instanceof Error && error.message.startsWith("Invalid XML") ? " El XML no es válido." : ""
        throw new FiscalError("SIGNING_FAILED", `No se pudo firmar el documento.${detail}`)
    }
}
