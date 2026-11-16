// Pure helpers: safe to import from client components (no Node APIs).

export const CERTIFICATION_TOTAL_STEPS = 15

export const DGII_CERTIFICATION_PORTAL_URL =
    "https://ecf.dgii.gov.do/certecf/portalcertificacion/Login?ReturnUrl=%2Fcertecf%2Fportalcertificacion"

export type CertificationStepAction =
    | "portal" | "urls" | "sign" | "testSet" | "approvals" | "simulation" | "printed" | "receivedDocuments" | "receivedApprovals"

export interface CertificationStepDef {
    id: number
    label: string
    summary: string
    bullets?: readonly string[]
    /** Controls rendered for the step: DGII portal button and/or the receptor URL fields. */
    actions: readonly CertificationStepAction[]
    /** Automatic tool that is not available yet: the step is completed manually in the DGII portal. */
    pendingTool?: string
}

export const CERTIFICATION_STEPS: readonly CertificationStepDef[] = [
    {
        id: 1,
        label: "URLs y XML de Postulación",
        summary: "Registra las tres URLs de servicio en el portal de la DGII y genera el archivo de postulación. Después descarga el XML de postulación, fírmalo con tu certificado y súbelo firmado al portal.",
        actions: ["portal", "urls", "sign"],
    },
    {
        id: 2,
        label: "Set de Pruebas ECF y RFCE",
        summary: "Descarga el Set de Pruebas ECF y RFCE desde el portal de certificación y prepáralo para cargarlo.",
        actions: ["portal", "testSet"],
    },
    {
        id: 3,
        label: "Aprobación Comercial (ACECF)",
        summary: "Descarga el set de datos de Aprobación Comercial desde el portal de certificación y cárgalo para enviarlo.",
        actions: ["portal", "approvals"],
    },
    {
        id: 4,
        label: "Pruebas de Simulación e-CF",
        summary: "Etapa que comprueba la capacidad de tu sistema para generar y enviar e-CF en XML a la DGII a partir de datos de operaciones reales.",
        bullets: [
            "Cada tipo de e-CF usa secuencias 1-10,000,000 que no se reutilizan entre intentos si un comprobante fue rechazado.",
            "Cada Factura de Consumo menor a RD$250,000 envía primero un Resumen (RFCE); tras ser aceptado, se cargan las facturas.",
            "Por cada e-CF enviado se conserva su representación impresa (con QR) para el siguiente paso.",
        ],
        actions: ["portal", "simulation"],
    },
    {
        id: 5,
        label: "Representación Impresa",
        summary: "Descarga la Representación Impresa (PDF con QR) de un comprobante de cada tipo y súbela al portal de certificación. Cada PDF lleva el e-NCF, código de seguridad, fecha de firma y el QR de validación DGII.",
        bullets: [
            "La suma de todos los archivos no puede superar 10MB (cada PDF pesa menos de 30KB).",
            "Es responsabilidad del contribuyente que la representación cumpla la Ley 32-23 y el Formato e-CF.",
        ],
        actions: ["portal", "printed"],
    },
    {
        id: 6,
        label: "Validación por la DGII",
        summary: "La DGII está validando los datos enviados. Puede tomar de 24 a 72 horas. Verifica el estado en el portal.",
        actions: ["portal"],
    },
    {
        id: 7,
        label: "Registro de URLs de Prueba",
        summary: "Las URLs de prueba son las tres URLs de servicio del Paso 1. Confirma que estén registradas en el portal de la DGII y avanza.",
        actions: ["portal", "urls"],
    },
    {
        id: 8,
        label: "Recepción de e-CF (Prueba)",
        summary: "La DGII enviará e-CF de prueba a tus URLs. Descarga el certificado raíz y presiona \"Inicio envío de pruebas\" en el portal.",
        actions: ["receivedDocuments", "portal"],
    },
    {
        id: 9,
        label: "Recepción de RFCE (Prueba)",
        summary: "La DGII enviará Facturas de Consumo Electrónicas (E32) de prueba. El mismo endpoint de recepción las recibirá automáticamente.",
        actions: ["receivedDocuments", "portal"],
    },
    {
        id: 10,
        label: "Recepción de ACECF (Prueba)",
        summary: "Verifica la recepción de Aprobaciones Comerciales (ACECF) en tu sistema.",
        actions: ["receivedApprovals", "portal"],
    },
    {
        id: 11,
        label: "Recepción de Notas (Prueba)",
        summary: "Verifica la recepción de Notas de Débito y Crédito en tu sistema.",
        actions: ["receivedDocuments", "portal"],
    },
    {
        id: 12,
        label: "Registro de URLs de Producción",
        summary: "Registra tus URLs definitivas en el portal de la DGII para el ambiente de producción.",
        actions: ["portal", "urls"],
    },
    {
        id: 13,
        label: "Declaración Jurada",
        summary: "Descarga la declaración jurada desde el portal de la DGII, fírmala con tu certificado digital y envíala a la DGII. Este paso no envía nada automáticamente.",
        actions: ["portal"],
        pendingTool: "Firma de la declaración jurada dentro del sistema",
    },
    {
        id: 14,
        label: "Verificación de Estatus",
        summary: "Verifica en el portal de la DGII que el Paso 15 aparezca como Finalizado y confírmalo aquí.",
        actions: ["portal"],
    },
    {
        id: 15,
        label: "Certificación Completada",
        summary: "La DGII confirmó la certificación. Ya puedes pasar al ambiente de producción y emitir e-CF reales.",
        actions: [],
    },
]

export interface CertificationProgress {
    currentStep: number
    completedSteps: number[]
}

export const INITIAL_CERTIFICATION_PROGRESS: CertificationProgress = { currentStep: 1, completedSteps: [] }

function isStep(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= CERTIFICATION_TOTAL_STEPS
}

/** Fails safe to step 1 for a missing, malformed or out-of-range row. */
export function restoreProgress(row: unknown): CertificationProgress {
    const raw = (row ?? {}) as { currentStep?: unknown; completedSteps?: unknown }
    const currentStep = isStep(raw.currentStep) ? raw.currentStep : 1
    const completed = Array.isArray(raw.completedSteps) ? raw.completedSteps.filter(isStep) : []
    return { currentStep, completedSteps: [...new Set(completed)].sort((a, b) => a - b) }
}

/** Marks `step` as done and moves to the next one (never past the last step). */
export function advanceProgress(progress: CertificationProgress, step: number): CertificationProgress {
    if (!isStep(step)) return progress
    const completedSteps = [...new Set([...progress.completedSteps, step])].sort((a, b) => a - b)
    return { currentStep: Math.min(step + 1, CERTIFICATION_TOTAL_STEPS), completedSteps }
}

/** Moves the cursor without changing what is completed. */
export function selectStep(progress: CertificationProgress, step: number): CertificationProgress {
    return isStep(step) ? { ...progress, currentStep: step } : progress
}
