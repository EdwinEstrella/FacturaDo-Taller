// Client-safe labels and helpers for the DGII test-set runner (no Node APIs, no secrets).

export type SubmissionKind = "ecf" | "rfce" | "portal_upload" | "acecf"
export type SubmissionStatus = "pending" | "sent" | "accepted" | "accepted_conditional" | "rejected" | "error" | "ready_for_portal"

export interface DgiiMessageView {
    codigo: string | null
    valor: string
}

export interface RunItemView {
    caseId: string
    encf: string
    tipoEcf: string
    kind: SubmissionKind
    sequenceOrder: number
    status: SubmissionStatus
    trackId: string | null
    messages: DgiiMessageView[]
    signed: boolean
}

export type CertificationRunType = "test_set" | "commercial_approval"

export interface RunView {
    runId: string
    runType: CertificationRunType
    environment: "test" | "certification"
    status: string
    createdAt: string
    counts: Record<SubmissionStatus, number>
    sendComplete: boolean
    done: boolean
    items: RunItemView[]
    waitingFor?: string | null
    stoppedReason?: string | null
}

export interface RunCopy {
    title: string
    description: string
    fileHint: string
    loaded: (count: number) => string
    sentAll: string
}

export const RUN_COPY: Record<CertificationRunType, RunCopy> = {
    test_set: {
        title: "Set de Pruebas de la DGII (.xlsx)",
        description:
            "Descarga el Excel del Set de Pruebas desde el portal de la DGII y cárgalo aquí. El sistema arma cada e-CF y RFCE, los firma con tu certificado y los envía a la DGII en el orden correcto.",
        fileHint: "Selecciona el archivo .xlsx del Set de Pruebas.",
        loaded: (count) => `Set de Pruebas cargado: ${count} documentos listos para enviar.`,
        sentAll: "Todos los documentos fueron enviados. Consulta el estado hasta que la DGII termine de procesarlos.",
    },
    commercial_approval: {
        title: "Set de Aprobaciones Comerciales de la DGII (.xlsx)",
        description:
            "Descarga el set de datos del Paso 3 en el portal de la DGII y cárgalo aquí. El sistema genera cada aprobación comercial (ACECF), la firma con tu certificado y la envía a la DGII.",
        fileHint: "Selecciona el archivo .xlsx del Set de Aprobaciones Comerciales.",
        loaded: (count) => `Set de Aprobaciones Comerciales cargado: ${count} aprobaciones listas para enviar.`,
        sentAll: "Todas las aprobaciones comerciales fueron enviadas. Revisa el estado de cada una en la tabla.",
    },
}

export const TEST_SET_MAX_BYTES = 2 * 1024 * 1024

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
    pending: "Pendiente",
    sent: "Enviado (en proceso)",
    accepted: "Aceptado",
    accepted_conditional: "Aceptado condicional",
    rejected: "Rechazado",
    error: "Error",
    ready_for_portal: "Firmado para el portal",
}

export const KIND_LABELS: Record<SubmissionKind, string> = {
    ecf: "e-CF (recepción)",
    rfce: "Resumen RFCE",
    portal_upload: "e-CF consumo < 250 mil (portal)",
    acecf: "Aprobación comercial",
}

export type StatusTone = "neutral" | "progress" | "success" | "warning" | "danger"

export function statusTone(status: SubmissionStatus): StatusTone {
    switch (status) {
        case "accepted":
        case "ready_for_portal":
            return "success"
        case "accepted_conditional":
            return "warning"
        case "rejected":
        case "error":
            return "danger"
        case "sent":
            return "progress"
        default:
            return "neutral"
    }
}

const ERROR_MESSAGES: Record<string, string> = {
    INVALID_TEST_SET: "El archivo no es un set válido de la DGII.",
    RNC_MISMATCH: "El RNC del Set de Pruebas no coincide con el RNC de tu negocio. Descarga el archivo de la empresa correcta.",
    CERTIFICATE_NOT_FOUND: "No hay un certificado digital válido. Súbelo en la sección «Certificado digital» de esta página.",
    CERTIFICATE_EXPIRED: "El certificado digital se encuentra vencido.",
    ENCRYPTION_KEY_MISSING: "El servidor no tiene configurada la clave de cifrado fiscal (ECF_ENCRYPTION_KEY).",
    RUN_NOT_FOUND: "No encontramos esa ejecución del Set de Pruebas. Cárgalo de nuevo.",
    NOT_READY: "Ese documento todavía no está firmado.",
    PAYLOAD_TOO_LARGE: "El archivo es demasiado grande (máximo 2 MB).",
    DGII_AUTH_REJECTED: "La DGII no aceptó la autenticación con tu certificado. Verifica que sea el certificado registrado en el portal.",
    DGII_UNAVAILABLE: "No se pudo conectar con la DGII o no respondió a tiempo. Inténtalo de nuevo en unos minutos.",
    CONCURRENT_BATCH: "Otro envío del Set de Pruebas está en curso. Espera a que termine.",
    NOT_CONFIGURED: "La base de datos todavía no tiene las tablas de certificación. Contacta a soporte.",
}

export const GENERIC_RUN_ERROR = "No se pudo procesar el Set de Pruebas. Inténtalo de nuevo en unos minutos."

/** Spanish message for a run error code; INVALID_TEST_SET keeps the technical detail. */
export function describeRunError(code: string | undefined, detail?: string): string {
    if (code === "INVALID_TEST_SET" && detail) return `${ERROR_MESSAGES.INVALID_TEST_SET} Detalle: ${detail}`
    return (code && ERROR_MESSAGES[code]) || GENERIC_RUN_ERROR
}

export function validateTestSetFile(file: { name: string; size: number }, runType: CertificationRunType = "test_set"): string | null {
    if (!/\.xlsx$/i.test(file.name)) return RUN_COPY[runType].fileHint
    if (file.size <= 0) return "El archivo está vacío."
    if (file.size > TEST_SET_MAX_BYTES) return "El archivo es demasiado grande (máximo 2 MB)."
    return null
}

export function describeProgress(run: RunView): string {
    const c = run.counts
    const total = run.items.length
    const accepted = c.accepted + c.accepted_conditional + c.ready_for_portal
    const failed = c.rejected + c.error
    if (run.runType === "commercial_approval") {
        return `${accepted + failed} de ${total} terminadas · ${accepted} aceptadas · ${failed} con error · ${c.pending} pendientes`
    }
    return `${accepted + failed} de ${total} terminados · ${accepted} aceptados o firmados · ${failed} con error · ${c.sent} en proceso · ${c.pending} pendientes`
}

/** Signed consumo (< 250k) e-CF that the user uploads in the DGII portal. */
export function portalDownloads(run: RunView): RunItemView[] {
    return run.items.filter((item) => item.kind === "portal_upload" && item.status === "ready_for_portal")
}

/** True when every RFCE of the run was accepted (the portal upload can be done). */
export function summariesAccepted(run: RunView): boolean {
    const summaries = run.items.filter((item) => item.kind === "rfce")
    return summaries.length > 0 && summaries.every((item) => item.status === "accepted" || item.status === "accepted_conditional")
}

export type LoopAction = "continue" | "poll" | "done" | "stop"

/** What the send loop does after a sendNext answer. */
export function nextLoopAction(run: RunView): LoopAction {
    if (run.stoppedReason) return "stop"
    if (run.waitingFor) return "poll"
    if (run.sendComplete) return "done"
    return "continue"
}

/** Whether a loaded run still has documents waiting for DGII, unless stopped or out of rounds. */
export function shouldAutoPoll(run: RunView, pollRounds: number, maxRounds: number): boolean {
    return run.counts.sent > 0 && !run.stoppedReason && pollRounds < maxRounds
}
