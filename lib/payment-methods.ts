export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Efectivo",
    TRANSFER: "Transferencia",
    CARD: "Tarjeta",
    CHECK: "Cheque",
    CREDIT: "Crédito",
}

/**
 * Returns the human-readable label for a payment method code.
 * Falls back to the raw code if no label is mapped.
 */
export function formatPaymentMethod(method: string | null | undefined): string {
    if (!method) return ""
    return PAYMENT_METHOD_LABELS[method] ?? method
}
