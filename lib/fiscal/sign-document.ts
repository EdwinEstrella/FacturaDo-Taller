// SERVER ONLY. Signs an arbitrary DGII XML document (e.g. the registration/postulation file)
// with already-decrypted signing material. Nothing is persisted.

import Signature from "../ecf/Signature/Signature"
import { FiscalError } from "./errors"

export function signXmlWithMaterial(input: { xml: string; key: string; cert: string }): string {
    if (!input.xml.trim()) {
        throw new FiscalError("XML_REQUIRED", "Selecciona el archivo XML que vas a firmar.")
    }

    try {
        return new Signature(input.key, input.cert).signXml(input.xml)
    } catch (error) {
        const detail = error instanceof Error && error.message.startsWith("Invalid XML") ? " El XML no es válido." : ""
        throw new FiscalError("SIGNING_FAILED", `No se pudo firmar el documento.${detail}`)
    }
}
