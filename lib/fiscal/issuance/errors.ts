import { FiscalError } from "../errors"

export class IssuanceError extends FiscalError {
    constructor(code: string, message?: string) {
        super(code, message || code, false)
        this.name = "IssuanceError"
    }
}

/**
 * Single centralized code -> Spanish message dictionary for all fiscal issuance errors.
 */
export const ISSUANCE_ERROR_SPANISH_MESSAGES: Record<string, string> = {
    ECF_SEQUENCE_NOT_CONFIGURED: "No hay una secuencia de comprobantes electrónicos configurada para este tipo. Configure la secuencia en Ajustes Fiscales.",
    ECF_SEQUENCE_EXPIRED: "La secuencia de comprobantes electrónicos ha vencido. Configure una nueva secuencia en Ajustes Fiscales.",
    ECF_SEQUENCE_EXHAUSTED: "La secuencia de comprobantes electrónicos se ha agotado. Solicite un nuevo rango a la DGII.",
    ECF_DISABLED: "La facturación electrónica está desactivada en la configuración fiscal.",
    ECF_ALREADY_ISSUED: "Esta factura ya tiene un comprobante electrónico emitido.",
    ISSUER_INCOMPLETE: "Datos del emisor incompletos en la configuración fiscal.",
    ISSUER_RNC_INVALID: "El RNC del emisor debe tener 9 u 11 dígitos.",
    ISSUER_LEGAL_NAME_REQUIRED: "La razón social del emisor es requerida.",
    ISSUER_ADDRESS_REQUIRED: "La dirección del emisor es requerida.",
    BUYER_RNC_REQUIRED: "El comprobante de crédito fiscal requiere un RNC o Cédula válido del comprador.",
    BUYER_NAME_REQUIRED: "El comprobante de crédito fiscal requiere el nombre o razón social del comprador.",
    INVALID_PAYMENT_METHOD: "Método de pago no válido para comprobantes fiscales.",
    PAYMENT_DUE_DATE_REQUIRED: "Las facturas a crédito requieren una fecha límite de pago.",
    SEQUENCE_EXPIRY_REQUIRED: "Factura de Crédito Fiscal (E31) requiere fecha de vencimiento de secuencia.",
    DISCOUNT_EXCEEDS_ITEMS: "El descuento no puede ser mayor que el monto bruto de los artículos.",
    DISCOUNT_ALLOCATION_INVALID: "El descuento asignado a la línea no es válido.",
    EMPTY_ITEMS: "La factura debe tener al menos un artículo.",
    INVALID_ITEM: "Hay artículos con datos inválidos (nombre, cantidad o precio).",
    INVALID_DISCOUNT: "El descuento no puede ser negativo.",
    INVALID_SHIPPING: "El costo de envío no puede ser negativo.",
    INVALID_ECF_TYPE: "Tipo de comprobante electrónico inválido.",
    INVALID_ENCF: "Número de comprobante electrónico inválido.",
    TOTALS_MISMATCH: "Los totales no coinciden con los montos de la factura.",
    PRODUCT_NOT_FOUND: "Uno o más productos no existen en la base de datos.",
    ENQUEUE_FAILED: "Error al encolar el comprobante electrónico.",
}

/**
 * Maps an issuance error or unknown error to a user-facing Spanish message via code dictionary.
 * Unknown errors log the original error with console.error and return a generic Spanish message.
 */
export function mapIssuanceErrorToSpanish(error: unknown): string {
    if (error && typeof error === "object" && "code" in error) {
        const code = String((error as { code: unknown }).code)
        if (code === "ISSUER_INCOMPLETE" && error instanceof Error && error.message && error.message !== "ISSUER_INCOMPLETE") {
            return error.message
        }
        if (ISSUANCE_ERROR_SPANISH_MESSAGES[code]) {
            return ISSUANCE_ERROR_SPANISH_MESSAGES[code]
        }
    }
    console.error("Unknown issuance error:", error)
    return "Error al emitir el comprobante electrónico."
}

export { FiscalError }
