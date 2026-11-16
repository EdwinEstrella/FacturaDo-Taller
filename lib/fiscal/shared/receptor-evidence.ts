// Pure helpers: safe to import from client components (no Node APIs).

export interface ReceivedDocumentView {
    id: string
    encf: string
    tipoEcf: string | null
    emisorRnc: string
    /** 0 = received, 1 = not received (motivo in `motivoNoRecibido`). */
    estado: number
    motivoNoRecibido: number | null
    signerRncMismatch: boolean
    receivedAt: string
}

export interface ReceivedApprovalView {
    id: string
    encf: string
    emisorRnc: string
    compradorRnc: string
    /** 1 = approved, 2 = rejected. */
    estado: number
    detalleMotivoRechazo: string | null
    receivedAt: string
}

export interface ReceptorEvidence {
    /** True when the public seed endpoint answered with a seed document. */
    online: boolean
    /** Public seed URL that was probed. */
    probeUrl: string
    documents: ReceivedDocumentView[]
    approvals: ReceivedApprovalView[]
}

/** ARECF CodigoMotivoNoRecibido meanings (DGII). */
const NOT_RECEIVED_REASONS: Record<number, string> = {
    1: "Error de especificación",
    2: "Firma digital inválida",
    3: "e-CF duplicado",
    4: "RNC comprador no corresponde",
}

export function describeReception(estado: number, motivo: number | null): string {
    if (estado === 0) return "Recibido"
    return `No recibido: ${(motivo !== null && NOT_RECEIVED_REASONS[motivo]) || "motivo desconocido"}`
}
