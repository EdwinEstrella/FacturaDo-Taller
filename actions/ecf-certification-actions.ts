"use server"

import { getCurrentUser } from "@/actions/auth-actions"
import { createServerClient } from "@/lib/insforge/client"
import Signature from "@/lib/ecf/Signature/Signature"
import { loadStoredSigningMaterial } from "@/lib/fiscal/stored-certificate"
import { FiscalError } from "@/lib/fiscal/errors"
import { createDgiiClient, DgiiError } from "@/lib/fiscal/certification/dgii-client"
import { createInsforgeRunStore } from "@/lib/fiscal/certification/store"
import * as certification from "@/lib/fiscal/certification/run"
import {
    describeRunError,
    GENERIC_RUN_ERROR,
    TEST_SET_MAX_BYTES,
    type CertificationRunType,
    type RunView,
} from "@/lib/fiscal/shared/certification-run"

/** The test set is executed in the DGII certification environment (CerteCF). */
const ENVIRONMENT: certification.RunEnvironment = "certification"

export type RunActionResult<T = RunView> = { success: true; run: T } | { success: false; error: string; code?: string }

async function requireAdmin() {
    const user = await getCurrentUser()
    if (!user || String(user.role).toUpperCase() !== "ADMIN") {
        throw new Error("Solo un administrador puede ejecutar la certificación DGII.")
    }
    return user
}

function buildDeps(): certification.RunDeps {
    return {
        store: createInsforgeRunStore(),
        async loadSigner(environment) {
            const { key, cert } = await loadStoredSigningMaterial(environment)
            const signature = new Signature(key, cert)
            return (xml, rootElement) => signature.signXml(xml, rootElement)
        },
        dgii: (environment) => createDgiiClient({ environment }),
        async companyRnc() {
            const { data } = await createServerClient().database.from("Setting").select("value").eq("key", "COMPANY_RNC").limit(1)
            return typeof data?.[0]?.value === "string" ? data[0].value.replace(/\D/g, "") : null
        },
        async companyName() {
            const { data } = await createServerClient().database.from("Setting").select("value").eq("key", "COMPANY_NAME").limit(1)
            return typeof data?.[0]?.value === "string" ? data[0].value.trim() : null
        },
        log: (event, detail) => console.info(`[ecf-certification] ${event}`, detail ?? {}),
    }
}

function toFailure(error: unknown): { success: false; error: string; code?: string } {
    if (error instanceof certification.CertificationError) {
        return { success: false, error: describeRunError(error.code, error.message), code: error.code }
    }
    if (error instanceof FiscalError) {
        return { success: false, error: describeRunError(error.code, error.message), code: error.code }
    }
    const message = error instanceof Error ? error.message : ""
    // Missing tables (migration not applied yet): the store fails with a generic operation error.
    if (/Certification store operation failed/.test(message)) {
        console.error("Certification store error:", message)
        return { success: false, error: describeRunError("NOT_CONFIGURED"), code: "NOT_CONFIGURED" }
    }
    console.error("Certification error:", message)
    return { success: false, error: GENERIC_RUN_ERROR }
}

/** A DGII outage stops the batch with a reason; surface it as the run's stop state. */
async function guarded<T>(work: () => Promise<T>): Promise<RunActionResult<T>> {
    try {
        await requireAdmin()
        return { success: true, run: await work() }
    } catch (error) {
        return toFailure(error)
    }
}

function parseRunType(value: unknown): CertificationRunType | null {
    return value === "test_set" || value === "commercial_approval" || value === "simulation" ? value : null
}

export async function startCertificationRun(formData: FormData): Promise<RunActionResult> {
    const runType = parseRunType(formData.get("runType"))
    if (!runType) return { success: false, error: GENERIC_RUN_ERROR }
    const file = formData.get("workbook")
    if (!(file instanceof File) || file.size === 0) {
        return { success: false, error: "Selecciona el archivo .xlsx del Set de Pruebas." }
    }
    if (file.size > TEST_SET_MAX_BYTES) return { success: false, error: describeRunError("PAYLOAD_TOO_LARGE") }

    return guarded(async () => {
        const user = await requireAdmin()
        return (await certification.startRun(buildDeps(), {
            environment: ENVIRONMENT,
            runType,
            xlsx: new Uint8Array(await file.arrayBuffer()),
            createdBy: user.username ?? null,
        })) as RunView
    })
}

export async function getLatestCertificationRun(runType: CertificationRunType): Promise<RunActionResult<RunView | null>> {
    const parsed = parseRunType(runType)
    if (!parsed) return { success: false, error: GENERIC_RUN_ERROR }
    return guarded(async () => (await certification.latestRun(buildDeps(), ENVIRONMENT, parsed)) as RunView | null)
}

export async function sendCertificationBatch(runId: string): Promise<RunActionResult> {
    return guarded(async () => (await certification.sendNext(buildDeps(), runId)) as RunView)
}

export async function refreshCertificationRun(runId: string): Promise<RunActionResult> {
    return guarded(async () => (await certification.pollStatus(buildDeps(), runId)) as RunView)
}

export async function downloadCertificationDocument(
    runId: string,
    caseId: string,
    kind?: "rfce"
): Promise<RunActionResult<{ fileName: string; signedXml: string }>> {
    return guarded(() => certification.downloadSigned(buildDeps(), runId, caseId, kind === "rfce" ? "rfce" : undefined))
}

/** Authenticates against DGII with the stored certificate; sends no document. */
export async function checkDgiiConnection(): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await requireAdmin()
        await certification.authCheck(buildDeps(), ENVIRONMENT)
        return { success: true }
    } catch (error) {
        if (error instanceof DgiiError) {
            return { success: false, error: describeRunError(error.kind === "unauthorized" ? "DGII_AUTH_REJECTED" : "DGII_UNAVAILABLE") }
        }
        const failure = toFailure(error)
        return { success: false, error: failure.error }
    }
}
