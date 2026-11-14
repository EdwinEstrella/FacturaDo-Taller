// Pure helpers: safe to import from client components (no Node APIs).

/** Public host the DGII calls for inbound e-CF services. */
export const ECF_RECEPTOR_HOST = "facturado.lat"

const SERVICE_PATHS = {
    reception: "/fe/recepcion/api/ecf",
    approval: "/fe/aprobacioncomercial/api/ecf",
    authentication: "/fe/autenticacion/api/[semilla|validacioncertificado]",
} as const

export interface ReceptorUrls {
    /** True when the issuer RNC is configured, so the value is safe to register at the DGII. */
    ready: boolean
    /**
     * What goes in each DGII portal field. The portal already shows "https://" before it and the
     * service path after it, so the full URL must not be pasted there.
     */
    portalField: string
    paths: typeof SERVICE_PATHS
}

export function rncDigits(rnc: string | null | undefined): string {
    return (rnc ?? "").replace(/\D/g, "")
}

export function buildReceptorUrls(rnc: string | null | undefined): ReceptorUrls {
    const digits = rncDigits(rnc)
    return {
        ready: digits.length === 9 || digits.length === 11,
        portalField: `${ECF_RECEPTOR_HOST}/${digits || "RNC"}`,
        paths: SERVICE_PATHS,
    }
}
