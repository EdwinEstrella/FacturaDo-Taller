// SERVER/WORKER ONLY. Never import lib/fiscal from client components.

export class FiscalError extends Error {
    readonly code: string
    readonly retryable: boolean

    constructor(code: string, message: string, retryable = false) {
        super(message)
        this.name = "FiscalError"
        this.code = code
        this.retryable = retryable
    }
}

export function toFiscalError(error: unknown, fallbackCode: string, retryable = false): FiscalError {
    if (error instanceof FiscalError) return error
    const message = error instanceof Error ? error.message : String(error)
    return new FiscalError(fallbackCode, message, retryable)
}
