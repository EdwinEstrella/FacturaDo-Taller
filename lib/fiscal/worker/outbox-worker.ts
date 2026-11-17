// SERVER ONLY. Fiscal outbox worker: turns queued e-CF documents into signed XML, submits them to
// DGII and polls their track IDs until DGII accepts or rejects them.
// It runs inside the public receptor server (facturado.lat), which holds INSFORGE_ADMIN_KEY and
// ECF_ENCRYPTION_KEY, so the desktop app never needs the signing key.
// Never log tokens, seeds, keys or XML.

import { createHash } from "node:crypto"
import { createFiscalAdminClient } from "../admin-client"
import { loadStoredSigningMaterial } from "../stored-certificate"
import Signature from "../../ecf/Signature/Signature"
import { createDgiiClient, DgiiError, isDgiiEnvironment, type DgiiClient, type DgiiEnvironment, type DgiiMessage } from "../certification/dgii-client"
import { mapDgiiStatus } from "../certification/run"
import { securityCodeFromSignedXml, stampSignatureTime } from "../certification/builder"
import { buildInvoiceEcfXml } from "../issuance/mapper"
import type { StoredInvoiceEcfSnapshot } from "../issuance/types"

type Db = ReturnType<typeof createFiscalAdminClient>["database"]
type Signer = (xml: string, rootElement: string) => string

export interface OutboxWorkerDeps {
    db: Db
    loadSigner: (environment: DgiiEnvironment) => Promise<Signer>
    dgii: (environment: DgiiEnvironment) => DgiiClient
    now: () => Date
    log: (event: string, data?: Record<string, unknown>) => void
    workerId: string
}

interface OutboxJob {
    id: string
    ecfDocumentId: string
    operation: "submit" | "poll_status" | "resubmit"
    status: string
    attempts: number
}

interface EcfDocumentRow {
    id: string
    invoiceId: string | null
    ecfType: "E31" | "E32" | "E34"
    encf: string
    sequenceExpiresOn: string
    status: string
    dgiiTrackId: string | null
    snapshot: StoredInvoiceEcfSnapshot | string | null
}

const BATCH_SIZE = 5
const MAX_SUBMIT_ATTEMPTS = 10
const MAX_POLL_ATTEMPTS = 60
const POLL_DELAY_MS = 20_000
const RFCE_THRESHOLD = 250_000

/** Thrown for documents that can never be sent as they are (bad snapshot, unsupported flow). */
class TerminalDocumentError extends Error {}

export function createOutboxWorkerDeps(): OutboxWorkerDeps {
    return {
        db: createFiscalAdminClient().database,
        async loadSigner(environment) {
            const { key, cert } = await loadStoredSigningMaterial(environment)
            const signature = new Signature(key, cert)
            return (xml, rootElement) => signature.signXml(xml, rootElement as Parameters<typeof signature.signXml>[1])
        },
        dgii: (environment) => createDgiiClient({ environment }),
        now: () => new Date(),
        log: (event, data) => console.log(`[fiscal-worker] ${event}`, data ? JSON.stringify(data) : ""),
        workerId: `fiscal-worker-${process.pid}`,
    }
}

function retryDelayMs(attempts: number): number {
    return Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000)
}

function messagesText(messages: DgiiMessage[]): string | null {
    const text = messages.map((m) => (m.codigo ? `${m.codigo}: ${m.valor}` : m.valor)).join(" | ")
    return text ? text.slice(0, 1000) : null
}

/**
 * Processes one batch of due outbox jobs. Returns how many jobs were handled.
 * One DGII token and one signer per batch; both stay inside this call.
 */
export async function processOutboxOnce(deps: OutboxWorkerDeps): Promise<number> {
    const { data: config, error: configError } = await deps.db.from("FiscalConfig").select("ecfEnabled, environment").eq("id", 1).maybeSingle()
    if (configError) throw new Error(`FiscalConfig read failed: ${configError.message}`)
    if (!config?.ecfEnabled || !isDgiiEnvironment(config.environment)) return 0
    const environment: DgiiEnvironment = config.environment

    const { data: jobs, error } = await deps.db
        .from("FiscalOutbox")
        .select("id, ecfDocumentId, operation, status, attempts")
        .in("status", ["queued", "retryable_error"])
        .lte("nextAttemptAt", deps.now().toISOString())
        .order("createdAt", { ascending: true })
        .limit(BATCH_SIZE)
    if (error) throw new Error(`FiscalOutbox read failed: ${error.message}`)
    if (!jobs || jobs.length === 0) return 0

    let signer: Signer | null = null
    let client: DgiiClient | null = null
    let token: string | null = null
    const sign = async (xml: string, root: string) => {
        signer ??= await deps.loadSigner(environment)
        return signer(xml, root)
    }
    const session = async () => {
        client ??= deps.dgii(environment)
        token ??= (await client.authenticate((seed) => sign(seed, "SemillaModel"))).token
        return { client, token }
    }

    let handled = 0
    for (const job of jobs as OutboxJob[]) {
        if (!(await claim(deps, job))) continue
        handled++
        try {
            if (job.operation === "poll_status") {
                await pollJob(deps, job, session)
            } else {
                await submitJob(deps, job, environment, sign, session)
            }
        } catch (err) {
            const stop = await failJob(deps, job, err)
            // DGII down or credentials rejected: stop the batch instead of hammering it.
            if (stop) break
        }
    }
    return handled
}

/** Optimistic claim: only one worker moves the job from its current status to processing. */
async function claim(deps: OutboxWorkerDeps, job: OutboxJob): Promise<boolean> {
    const { data, error } = await deps.db
        .from("FiscalOutbox")
        .update({
            status: "processing",
            attempts: job.attempts + 1,
            lockedBy: deps.workerId,
            lockedAt: deps.now().toISOString(),
            updatedAt: deps.now().toISOString(),
        })
        .eq("id", job.id)
        .eq("status", job.status)
        .select("id")
    if (error) throw new Error(`FiscalOutbox claim failed: ${error.message}`)
    job.attempts += 1
    return Boolean(data && data.length > 0)
}

async function loadDocument(deps: OutboxWorkerDeps, id: string): Promise<EcfDocumentRow> {
    const { data, error } = await deps.db
        .from("EcfDocument")
        .select("id, invoiceId, ecfType, encf, sequenceExpiresOn, status, dgiiTrackId, snapshot")
        .eq("id", id)
        .single()
    if (error || !data) throw new Error(`EcfDocument ${id} not found`)
    return data as EcfDocumentRow
}

async function updateDocument(
    deps: OutboxWorkerDeps,
    doc: EcfDocumentRow,
    toStatus: string,
    patch: Record<string, unknown>,
    reason: string,
    metadata: Record<string, unknown> = {}
) {
    const now = deps.now().toISOString()
    const { error } = await deps.db.from("EcfDocument").update({ ...patch, status: toStatus, updatedAt: now }).eq("id", doc.id)
    if (error) throw new Error(`EcfDocument update failed: ${error.message}`)
    await deps.db.from("EcfDocumentEvent").insert([{
        ecfDocumentId: doc.id,
        fromStatus: doc.status,
        toStatus,
        reason,
        metadata,
        createdBy: deps.workerId,
    }])
    doc.status = toStatus
}

async function finishJob(deps: OutboxWorkerDeps, job: OutboxJob, status: "done" | "terminal_error", errorMessage: string | null = null) {
    await deps.db
        .from("FiscalOutbox")
        .update({ status, errorMessage, lockedBy: null, lockedAt: null, updatedAt: deps.now().toISOString() })
        .eq("id", job.id)
}

async function rescheduleJob(deps: OutboxWorkerDeps, job: OutboxJob, delayMs: number, errorMessage: string | null, status: "queued" | "retryable_error") {
    await deps.db
        .from("FiscalOutbox")
        .update({
            status,
            errorMessage,
            nextAttemptAt: new Date(deps.now().getTime() + delayMs).toISOString(),
            lockedBy: null,
            lockedAt: null,
            updatedAt: deps.now().toISOString(),
        })
        .eq("id", job.id)
}

function parseSnapshot(doc: EcfDocumentRow): StoredInvoiceEcfSnapshot {
    const raw = typeof doc.snapshot === "string" ? JSON.parse(doc.snapshot) : doc.snapshot
    if (!raw?.issuer || !raw?.invoice) throw new TerminalDocumentError("El documento no tiene los datos congelados de la factura.")
    return raw as StoredInvoiceEcfSnapshot
}

async function submitJob(
    deps: OutboxWorkerDeps,
    job: OutboxJob,
    environment: DgiiEnvironment,
    sign: (xml: string, root: string) => Promise<string>,
    session: () => Promise<{ client: DgiiClient; token: string }>
) {
    const doc = await loadDocument(deps, job.ecfDocumentId)
    if (doc.dgiiTrackId || ["submitted", "accepted", "rejected"].includes(doc.status)) {
        // Already sent by an earlier attempt: never send the same e-NCF twice.
        await finishJob(deps, job, "done")
        return
    }
    if (doc.ecfType !== "E31" && doc.ecfType !== "E32") {
        throw new TerminalDocumentError(`El envío de ${doc.ecfType} todavía no está soportado.`)
    }

    const snapshot = parseSnapshot(doc)
    const built = buildInvoiceEcfXml(
        snapshot.issuer,
        { ...snapshot.invoice, ecfType: doc.ecfType, encf: doc.encf, sequenceExpiresOn: doc.sequenceExpiresOn?.slice(0, 10) ?? null },
        deps.now()
    )
    if (doc.ecfType === "E32" && built.fiscalTotals.totalAmount < RFCE_THRESHOLD) {
        throw new TerminalDocumentError("Las facturas de consumo menores a RD$250,000 se envían por resumen (RFCE), que todavía no está soportado.")
    }

    const signedXml = await sign(stampSignatureTime(built.xml, deps.now()), "ECF")
    const securityCode = securityCodeFromSignedXml(signedXml)
    const xmlHash = createHash("sha256").update(signedXml).digest("hex")
    const fileName = `${snapshot.issuer.rnc.replace(/\D/g, "")}${doc.encf}.xml`

    const { client, token } = await session()
    const result = await client.sendEcf(token, fileName, signedXml)
    const messages = messagesText(result.messages)

    if (!result.trackId) {
        if (result.httpStatus >= 400 && result.httpStatus < 500) {
            await updateDocument(deps, doc, "rejected", {
                dgiiSecurityCode: securityCode,
                xmlHash,
                dgiiStatusCode: String(result.httpStatus),
                dgiiStatusMessage: messages,
                dgiiMessages: result.messages,
                rejectedAt: deps.now().toISOString(),
                lastError: messages,
            }, "dgii_rejected_on_submit", { environment })
            await finishJob(deps, job, "done")
            return
        }
        throw new Error(`DGII no devolvió trackId (HTTP ${result.httpStatus}). ${messages ?? ""}`.trim())
    }

    await updateDocument(deps, doc, "submitted", {
        dgiiTrackId: result.trackId,
        dgiiSecurityCode: securityCode,
        xmlHash,
        dgiiMessages: result.messages,
        submittedAt: deps.now().toISOString(),
        lastError: null,
    }, "submitted_to_dgii", { environment, fileName, signedXml })

    await deps.db.from("FiscalOutbox").insert([{
        ecfDocumentId: doc.id,
        operation: "poll_status",
        status: "queued",
        idempotencyKey: `poll:${doc.id}`,
        nextAttemptAt: new Date(deps.now().getTime() + POLL_DELAY_MS).toISOString(),
    }])
    await finishJob(deps, job, "done")
    deps.log("submitted", { encf: doc.encf, environment })
}

async function pollJob(
    deps: OutboxWorkerDeps,
    job: OutboxJob,
    session: () => Promise<{ client: DgiiClient; token: string }>
) {
    const doc = await loadDocument(deps, job.ecfDocumentId)
    if (!doc.dgiiTrackId) throw new TerminalDocumentError("El documento no tiene trackId de la DGII.")

    const { client, token } = await session()
    const result = await client.trackStatus(token, doc.dgiiTrackId)
    const status = mapDgiiStatus(result.estado, result.codigo)
    const messages = messagesText(result.messages)

    if (status === "accepted" || status === "accepted_conditional") {
        await updateDocument(deps, doc, "accepted", {
            dgiiStatusCode: result.codigo === null ? null : String(result.codigo),
            dgiiStatusMessage: result.estado,
            dgiiMessages: result.messages,
            acceptedAt: deps.now().toISOString(),
        }, status === "accepted" ? "dgii_accepted" : "dgii_accepted_conditional")
        await finishJob(deps, job, "done")
        deps.log("accepted", { encf: doc.encf, conditional: status === "accepted_conditional" })
        return
    }
    if (status === "rejected") {
        await updateDocument(deps, doc, "rejected", {
            dgiiStatusCode: result.codigo === null ? null : String(result.codigo),
            dgiiStatusMessage: result.estado,
            dgiiMessages: result.messages,
            rejectedAt: deps.now().toISOString(),
            lastError: messages,
        }, "dgii_rejected")
        await finishJob(deps, job, "done")
        deps.log("rejected", { encf: doc.encf })
        return
    }

    // Still processing at DGII.
    if (job.attempts >= MAX_POLL_ATTEMPTS) {
        await finishJob(deps, job, "terminal_error", "La DGII no respondió el estado a tiempo; consulte el trackId manualmente.")
        return
    }
    await rescheduleJob(deps, job, POLL_DELAY_MS, null, "queued")
}

/** Records a failed attempt. Returns true when the batch should stop (DGII unavailable or auth rejected). */
async function failJob(deps: OutboxWorkerDeps, job: OutboxJob, err: unknown): Promise<boolean> {
    const message = err instanceof Error ? err.message.slice(0, 1000) : "Error desconocido"
    const isTerminal = err instanceof TerminalDocumentError || (err instanceof Error && err.name === "IssuanceError")
    const maxAttempts = job.operation === "poll_status" ? MAX_POLL_ATTEMPTS : MAX_SUBMIT_ATTEMPTS
    deps.log("job_failed", { jobId: job.id, operation: job.operation, attempts: job.attempts, kind: err instanceof DgiiError ? err.kind : err instanceof Error ? err.name : "unknown" })

    if (isTerminal || job.attempts >= maxAttempts) {
        await finishJob(deps, job, "terminal_error", message)
        try {
            const doc = await loadDocument(deps, job.ecfDocumentId)
            if (!["accepted", "rejected", "submitted"].includes(doc.status)) {
                await updateDocument(deps, doc, "terminal_error", { lastError: message }, "worker_terminal_error")
            }
        } catch {
            // The outbox row already carries the error.
        }
        return false
    }

    await rescheduleJob(deps, job, retryDelayMs(job.attempts), message, "retryable_error")
    return err instanceof DgiiError
}
