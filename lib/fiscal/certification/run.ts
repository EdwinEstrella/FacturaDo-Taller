// DGII test-set runs: plan, resumable submission batches, status polling and portal downloads.
// Port of cyberbistro supabase/functions/ecf-certification/run.ts for a single-tenant workshop
// (no tenant scoping; the server action layer handles authorization).
//
// Submission order (sequenceOrder):
//  1. Every E32 listed in the RFCE sheet (consumo < RD$250k), in ECF-sheet order: first the full E32
//     is signed and kept for the portal upload (kind portal_upload, never sent through the API),
//     then its RFCE (kind rfce) is sent to the summaries service with the E32 security code.
//  2. Every other e-CF goes to the reception service in sheet order, except that a document
//     referenced by another one (InformacionReferencia/NCFModificado, e.g. the invoice an E33/E34
//     note modifies) is moved right before its first referrer. A referrer is only sent once the
//     referenced document is accepted by DGII, so sendNext pauses (waitingFor) until status polling
//     records that acceptance.
import {
    applySecurityCode,
    buildTestSet,
    securityCodeFromSignedXml,
    stampSignatureTime,
    TestSetError,
    type BuiltDocument,
    type TestSet,
} from "./builder"
import { buildCommercialApprovals, detectWorkbookType, type BuiltApproval } from "./commercial-approval"
import { DgiiError, type DgiiClient, type DgiiEnvironment, type DgiiMessage, type DgiiSendResult } from "./dgii-client"
import { readXlsx, XlsxError } from "./xlsx"

export type SubmissionKind = "ecf" | "rfce" | "portal_upload" | "acecf"
export type RunType = "test_set" | "commercial_approval" | "simulation"
export type SubmissionStatus = "pending" | "sent" | "accepted" | "accepted_conditional" | "rejected" | "error" | "ready_for_portal"
export type RunEnvironment = "test" | "certification"
export type RunStatus = "pending" | "running" | "completed" | "failed"

export interface PlannedSubmission {
    caseId: string
    encf: string
    tipoEcf: string
    kind: SubmissionKind
    sequenceOrder: number
    dependsOnCaseId: string | null
    unsignedXml: string
}

export interface Submission extends PlannedSubmission {
    id: string
    status: SubmissionStatus
    trackId: string | null
    messages: DgiiMessage[]
    signedXml: string | null
    securityCode: string | null
    attempts: number
}

export interface SubmissionPatch {
    status?: SubmissionStatus
    trackId?: string | null
    messages?: DgiiMessage[]
    signedXml?: string | null
    signedSha256?: string | null
    securityCode?: string | null
    attempts?: number
}

export interface Run {
    id: string
    environment: RunEnvironment
    runType: RunType
    status: RunStatus
    createdAt: string
}

export interface RunStore {
    createRun(input: {
        environment: RunEnvironment
        runType: RunType
        sourceSha256: string
        createdBy: string | null
        submissions: PlannedSubmission[]
    }): Promise<Run>
    getRun(runId: string): Promise<Run | null>
    latestRun(environment: RunEnvironment, runType: RunType): Promise<Run | null>
    /** Ordered by sequenceOrder. */
    listSubmissions(runId: string): Promise<Submission[]>
    /**
     * Applies the patch; with `expected`, only when the row still has that status and attempt count
     * (optimistic claim so two concurrent batches never send the same document). Returns whether a
     * row was updated.
     */
    updateSubmission(id: string, patch: SubmissionPatch, expected?: { status: SubmissionStatus; attempts: number }): Promise<boolean>
    setRunStatus(runId: string, status: RunStatus): Promise<void>
}

export type Signer = (xml: string, rootElement: string) => string

export interface RunDeps {
    store: RunStore
    /** Signs with the stored certificate of the DGII environment. */
    loadSigner(environment: DgiiEnvironment): Promise<Signer>
    /** A fresh client per call: tokens are never shared between calls. */
    dgii(environment: DgiiEnvironment): DgiiClient
    /** RNC of the business (digits only), or null when not configured. */
    companyRnc(): Promise<string | null>
    log(event: string, detail?: Record<string, unknown>): void
    now?(): number
    /** Wall-clock budget of one sendNext call; defaults to 40s. */
    budgetMs?: number
}

/** Failure with a stable code the UI maps to a Spanish message. */
export class CertificationError extends Error {
    constructor(readonly code: string, message: string) {
        super(message)
        this.name = "CertificationError"
    }
}

export const MAX_XLSX_BYTES = 2 * 1024 * 1024
export const MAX_SEND_LIMIT = 5
export const MAX_STATUS_POLLS = 10
export const MAX_ATTEMPTS = 3
const DEFAULT_BUDGET_MS = 40_000
const ACCEPTED: SubmissionStatus[] = ["accepted", "accepted_conditional"]
const TERMINAL: SubmissionStatus[] = ["accepted", "accepted_conditional", "rejected", "error", "ready_for_portal"]

/** Orders the documents of a test set (see the rule at the top of this file). */
export function planSubmissions(set: TestSet): PlannedSubmission[] {
    const out: PlannedSubmission[] = []
    const push = (doc: BuiltDocument, kind: SubmissionKind, dependsOnCaseId: string | null) =>
        out.push({
            caseId: doc.caseId,
            encf: doc.encf,
            tipoEcf: doc.tipoEcf,
            kind,
            sequenceOrder: out.length,
            dependsOnCaseId,
            unsignedXml: doc.xml,
        })

    const summaries = new Map(set.rfce.map((doc) => [doc.encf, doc]))
    for (const doc of set.ecf) {
        const summary = summaries.get(doc.encf)
        if (!summary) continue
        push(doc, "portal_upload", null)
        push(summary, "rfce", doc.caseId)
    }

    const byEncf = new Map(set.ecf.map((doc) => [doc.encf, doc]))
    const remaining = set.ecf.filter((doc) => !summaries.has(doc.encf))
    const placed = new Set<string>()
    const visiting = new Set<string>()
    const visit = (doc: BuiltDocument) => {
        if (placed.has(doc.encf) || visiting.has(doc.encf)) return
        visiting.add(doc.encf)
        const referenced = doc.references && doc.references !== doc.encf ? byEncf.get(doc.references) : undefined
        if (referenced && !summaries.has(referenced.encf)) visit(referenced)
        visiting.delete(doc.encf)
        placed.add(doc.encf)
        push(doc, "ecf", referenced ? referenced.caseId : null)
    }
    remaining.forEach(visit)
    return out
}

/** Commercial approvals are independent: sent in sheet order, no dependencies. */
export function planApprovals(approvals: BuiltApproval[]): PlannedSubmission[] {
    return approvals.map((doc, sequenceOrder) => ({
        caseId: doc.caseId,
        encf: doc.encf,
        tipoEcf: doc.tipoEcf,
        kind: "acecf" as const,
        sequenceOrder,
        dependsOnCaseId: null,
        unsignedXml: doc.xml,
    }))
}

/**
 * Commercial approval answer -> status. The service answers synchronously: codigo 01 "Aprobacion
 * Comercial Aprobada", 02 "Aprobacion Comercial Rechazada". Answering "rechazada" to an approval that
 * itself declared Estado 2 is the expected outcome, so it counts as accepted.
 */
export function mapApprovalResult(result: DgiiSendResult, submittedEstado: string | null): SubmissionPatch {
    const estado = (result.estado ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    const approved = result.codigo === 1 || (result.codigo === null && estado.includes("aprobada"))
    const rejected = result.codigo === 2 || (result.codigo === null && estado.includes("rechazada"))
    if (result.httpStatus < 400 && approved) return { status: "accepted", messages: result.messages }
    if (result.httpStatus < 400 && rejected && submittedEstado === "2") return { status: "accepted", messages: result.messages }
    return { status: result.httpStatus >= 400 || rejected ? "rejected" : "error", messages: result.messages }
}

/** The submission whose outcome gates this one, if any. */
function dependencyOf(sub: Submission, all: Submission[]): Submission | null {
    if (!sub.dependsOnCaseId) return null
    const candidates = all.filter((other) => other.caseId === sub.dependsOnCaseId && other !== sub)
    if (sub.kind === "rfce") return candidates.find((other) => other.kind === "portal_upload") ?? null
    // A reference to a consumo E32 is satisfied by the acceptance of its summary.
    return candidates.find((other) => other.kind === "ecf") ?? candidates.find((other) => other.kind === "rfce") ?? null
}

/** DGII estado/codigo -> submission status (null when DGII is still processing). */
export function mapDgiiStatus(estado: string | null, codigo: number | null): SubmissionStatus | null {
    const normalized = (estado ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()
    if (normalized === "aceptado") return "accepted"
    if (normalized === "aceptado condicional") return "accepted_conditional"
    if (normalized === "rechazado") return "rejected"
    if (normalized === "en proceso" || normalized === "no encontrado") return null
    if (codigo === 1) return "accepted"
    if (codigo === 2) return "rejected"
    if (codigo === 4) return "accepted_conditional"
    return null
}

export interface SubmissionView {
    caseId: string
    encf: string
    tipoEcf: string
    kind: SubmissionKind
    sequenceOrder: number
    status: SubmissionStatus
    trackId: string | null
    messages: DgiiMessage[]
    /** A signed copy is stored (downloadable for portal uploads). */
    signed: boolean
}

export interface RunSummary {
    runId: string
    environment: RunEnvironment
    runType: RunType
    status: RunStatus
    createdAt: string
    counts: Record<SubmissionStatus, number>
    /** No pending documents left (sent documents may still await their DGII status). */
    sendComplete: boolean
    /** Every document reached a final state. */
    done: boolean
    items: SubmissionView[]
}

export function summarize(run: Run, subs: Submission[]): RunSummary {
    const counts: Record<SubmissionStatus, number> = {
        pending: 0,
        sent: 0,
        accepted: 0,
        accepted_conditional: 0,
        rejected: 0,
        error: 0,
        ready_for_portal: 0,
    }
    for (const sub of subs) counts[sub.status]++
    return {
        runId: run.id,
        environment: run.environment,
        runType: run.runType,
        status: run.status,
        createdAt: run.createdAt,
        counts,
        sendComplete: counts.pending === 0,
        done: subs.every((sub) => TERMINAL.includes(sub.status)),
        items: subs.map((sub) => ({
            caseId: sub.caseId,
            encf: sub.encf,
            tipoEcf: sub.tipoEcf,
            kind: sub.kind,
            sequenceOrder: sub.sequenceOrder,
            status: sub.status,
            trackId: sub.trackId,
            messages: sub.messages,
            signed: !!sub.signedXml,
        })),
    }
}

async function sha256Hex(value: string | Uint8Array): Promise<string> {
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value
    const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource)
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "")

async function requireRun(deps: RunDeps, runId: string): Promise<Run> {
    const run = await deps.store.getRun(runId)
    if (!run) throw new CertificationError("RUN_NOT_FOUND", "The certification run does not exist.")
    return run
}

const WORKBOOK_LABEL: Record<RunType, string> = {
    test_set: "un Set de Pruebas (hojas ECF/RFCE)",
    commercial_approval: "un set de Aprobaciones Comerciales (hoja ACEECF_Generadas)",
    simulation: "un Set de Pruebas (hojas ECF/RFCE)",
}

/**
 * Parses a DGII workbook and stores a new run with its planned submissions. `runType` is the type
 * the screen expects: a workbook of the other type is rejected.
 */
export async function startRun(
    deps: RunDeps,
    input: { environment: RunEnvironment; runType: Extract<RunType, "test_set" | "commercial_approval">; xlsx: Uint8Array; createdBy: string | null }
): Promise<RunSummary> {
    if (input.xlsx.byteLength > MAX_XLSX_BYTES) {
        throw new CertificationError("PAYLOAD_TOO_LARGE", "The workbook is too large.")
    }

    let set: TestSet | null = null
    let approvals: BuiltApproval[] = []
    try {
        const sheets = await readXlsx(input.xlsx)
        const workbookType = detectWorkbookType(sheets)
        if (workbookType !== input.runType) {
            throw new TestSetError(`Este archivo es ${WORKBOOK_LABEL[workbookType]}, pero se esperaba ${WORKBOOK_LABEL[input.runType]}.`)
        }
        if (input.runType === "test_set") set = buildTestSet(sheets)
        else approvals = buildCommercialApprovals(sheets, new Date((deps.now ?? Date.now)()))
    } catch (error) {
        if (error instanceof XlsxError || error instanceof TestSetError) {
            deps.log("workbook_invalid")
            throw new CertificationError("INVALID_TEST_SET", error.message)
        }
        throw error
    }

    const rnc = digits(await deps.companyRnc())
    const rncs = set ? [...set.ecf, ...set.rfce].map((doc) => doc.rncEmisor) : approvals.map((doc) => doc.rncComprador)
    if (!rnc || rncs.some((value) => value !== rnc)) {
        throw new CertificationError(
            "RNC_MISMATCH",
            set ? "The test set RNCEmisor does not match the business RNC." : "The approval set RNCComprador does not match the business RNC."
        )
    }

    // Fail early when the certificate is missing or unreadable, before storing anything.
    await deps.loadSigner(input.environment)

    const run = await deps.store.createRun({
        environment: input.environment,
        runType: input.runType,
        sourceSha256: await sha256Hex(input.xlsx),
        createdBy: input.createdBy,
        submissions: set ? planSubmissions(set) : planApprovals(approvals),
    })
    deps.log("run_started", { runType: input.runType, ...(set ? { ecf: set.ecf.length, rfce: set.rfce.length } : { acecf: approvals.length }) })
    return summarize(run, await deps.store.listSubmissions(run.id))
}

async function refreshRunStatus(deps: RunDeps, run: Run, subs: Submission[]): Promise<Run> {
    const status: RunStatus = subs.every((sub) => TERMINAL.includes(sub.status)) ? "completed" : "running"
    if (status !== run.status) await deps.store.setRunStatus(run.id, status)
    return { ...run, status }
}

function failureMessage(error: DgiiError): DgiiMessage[] {
    const base: DgiiMessage = { codigo: error.status === null ? null : String(error.status), valor: `DGII: ${error.kind}` }
    return [base, ...error.messages].slice(0, 20)
}

function mapSendResult(sub: Submission, result: DgiiSendResult): SubmissionPatch {
    if (sub.kind === "acecf") return mapApprovalResult(result, /<Estado>([12])<\/Estado>/.exec(sub.unsignedXml)?.[1] ?? null)
    if (sub.kind === "ecf") {
        if (result.trackId) return { status: "sent", trackId: result.trackId, messages: result.messages }
        return { status: result.httpStatus >= 400 ? "rejected" : "error", messages: result.messages }
    }
    const mapped = mapDgiiStatus(result.estado, result.codigo)
    if (mapped) return { status: mapped, messages: result.messages }
    return { status: result.httpStatus >= 400 ? "rejected" : "error", messages: result.messages }
}

export interface SendNextResult extends RunSummary {
    processed: number
    /** caseId whose DGII acceptance is awaited before the next document can be sent. */
    waitingFor: string | null
    /** Set when the batch stopped early because DGII failed; the documents stay pending. */
    stoppedReason: string | null
}

export async function sendNext(deps: RunDeps, runId: string, limit: number = MAX_SEND_LIMIT): Promise<SendNextResult> {
    const run = await requireRun(deps, runId)
    const batchLimit = Math.min(Math.max(1, Math.trunc(limit)), MAX_SEND_LIMIT)
    const now = deps.now ?? Date.now
    const started = now()
    const budget = deps.budgetMs ?? DEFAULT_BUDGET_MS
    const subs = await deps.store.listSubmissions(run.id)

    let sign: Signer | null = null
    let client: DgiiClient | null = null
    // One DGII token per call; it never leaves this function.
    let token: string | null = null
    const signWith = async (xml: string, root: string) => {
        sign ??= await deps.loadSigner(run.environment)
        return sign(xml, root)
    }
    const tokenFor = async (): Promise<{ client: DgiiClient; token: string }> => {
        client ??= deps.dgii(run.environment)
        token ??= (await client.authenticate((seed) => signWith(seed, "SemillaModel"))).token
        return { client, token }
    }

    let processed = 0
    let waitingFor: string | null = null
    let stoppedReason: string | null = null

    for (const sub of subs) {
        if (sub.status !== "pending") continue
        if (processed >= batchLimit || now() - started > budget) break

        const dependency = dependencyOf(sub, subs)
        if (sub.kind === "rfce" && (!dependency || dependency.status !== "ready_for_portal" || !dependency.securityCode)) {
            waitingFor = sub.dependsOnCaseId
            break
        }
        if (sub.kind === "ecf" && dependency && !ACCEPTED.includes(dependency.status)) {
            if (dependency.status === "rejected" || dependency.status === "error") {
                const patch: SubmissionPatch = {
                    status: "error",
                    messages: [{ codigo: null, valor: `The referenced document ${dependency.encf} was not accepted by DGII.` }],
                }
                if (await deps.store.updateSubmission(sub.id, patch, { status: "pending", attempts: sub.attempts })) Object.assign(sub, patch)
                continue
            }
            waitingFor = dependency.caseId
            break
        }

        if (sub.kind !== "portal_upload") {
            // Authenticate before claiming, so a DGII outage does not consume attempts.
            try {
                await tokenFor()
            } catch (error) {
                if (!(error instanceof DgiiError)) throw error
                deps.log("dgii_auth_failed", { kind: error.kind, status: error.status })
                stoppedReason = error.kind === "unauthorized" ? "DGII_AUTH_REJECTED" : "DGII_UNAVAILABLE"
                break
            }
        }

        // Claim the row: a concurrent batch that already took it makes this update a no-op.
        if (!(await deps.store.updateSubmission(sub.id, { attempts: sub.attempts + 1 }, { status: "pending", attempts: sub.attempts }))) {
            stoppedReason = "CONCURRENT_BATCH"
            break
        }
        sub.attempts += 1
        processed++

        if (sub.kind === "portal_upload") {
            const signedXml = await signWith(stampSignatureTime(sub.unsignedXml, new Date(now())), "ECF")
            const patch: SubmissionPatch = {
                status: "ready_for_portal",
                signedXml,
                signedSha256: await sha256Hex(signedXml),
                securityCode: securityCodeFromSignedXml(signedXml),
                messages: [],
            }
            await deps.store.updateSubmission(sub.id, patch)
            Object.assign(sub, patch)
            continue
        }

        const signedXml =
            sub.kind === "acecf"
                ? await signWith(sub.unsignedXml, "ACECF")
                : sub.kind === "ecf"
                    ? await signWith(stampSignatureTime(sub.unsignedXml, new Date(now())), "ECF")
                    : await signWith(applySecurityCode(sub.unsignedXml, dependency!.securityCode!), "RFCE")
        const signedSha256 = await sha256Hex(signedXml)
        // For an approval the caseId is RNCComprador + eNCF, which is also the DGII file name.
        const fileName = `${sub.caseId}.xml`
        let patch: SubmissionPatch
        try {
            const dgii = await tokenFor()
            const result =
                sub.kind === "acecf"
                    ? await dgii.client.sendCommercialApproval(dgii.token, fileName, signedXml)
                    : sub.kind === "ecf"
                        ? await dgii.client.sendEcf(dgii.token, fileName, signedXml)
                        : await dgii.client.sendRfce(dgii.token, fileName, signedXml)
            patch = { ...mapSendResult(sub, result), signedXml, signedSha256 }
        } catch (error) {
            if (!(error instanceof DgiiError)) throw error
            // Keep the document pending (up to MAX_ATTEMPTS) and stop the batch: no retry storms.
            deps.log("dgii_send_failed", { kind: error.kind, status: error.status })
            patch = { status: sub.attempts >= MAX_ATTEMPTS ? "error" : "pending", messages: failureMessage(error) }
            stoppedReason = error.kind === "unauthorized" ? "DGII_AUTH_REJECTED" : "DGII_UNAVAILABLE"
        }
        await deps.store.updateSubmission(sub.id, patch)
        Object.assign(sub, patch)
        if (stoppedReason) break
    }

    const updated = await refreshRunStatus(deps, run, subs)
    deps.log("send_next", { processed, waiting: waitingFor !== null, stopped: stoppedReason })
    return { ...summarize(updated, subs), processed, waitingFor, stoppedReason }
}

export interface PollResult extends RunSummary {
    polled: number
    stoppedReason: string | null
}

export async function pollStatus(deps: RunDeps, runId: string): Promise<PollResult> {
    const run = await requireRun(deps, runId)
    const subs = await deps.store.listSubmissions(run.id)
    const toPoll = subs.filter((sub) => sub.status === "sent" && sub.trackId).slice(0, MAX_STATUS_POLLS)
    let stoppedReason: string | null = null
    if (toPoll.length > 0) {
        const sign = await deps.loadSigner(run.environment)
        const client = deps.dgii(run.environment)
        try {
            const { token } = await client.authenticate((seed) => sign(seed, "SemillaModel"))
            for (const sub of toPoll) {
                const result = await client.trackStatus(token, sub.trackId!)
                const status = mapDgiiStatus(result.estado, result.codigo)
                const patch: SubmissionPatch = { messages: result.messages }
                if (status) patch.status = status
                await deps.store.updateSubmission(sub.id, patch)
                Object.assign(sub, patch)
            }
        } catch (error) {
            if (!(error instanceof DgiiError)) throw error
            deps.log("dgii_status_failed", { kind: error.kind, status: error.status })
            stoppedReason = error.kind === "unauthorized" ? "DGII_AUTH_REJECTED" : "DGII_UNAVAILABLE"
        }
    }
    const updated = await refreshRunStatus(deps, run, subs)
    return { ...summarize(updated, subs), polled: toPoll.length, stoppedReason }
}

export async function latestRun(deps: RunDeps, environment: RunEnvironment, runType: RunType = "test_set"): Promise<RunSummary | null> {
    const run = await deps.store.latestRun(environment, runType)
    if (!run) return null
    return summarize(run, await deps.store.listSubmissions(run.id))
}

/** Only the consumo e-CF signed for the portal upload is downloadable in a test-set run. */
export async function downloadSigned(
    deps: RunDeps,
    runId: string,
    caseId: string
): Promise<{ fileName: string; signedXml: string }> {
    const run = await requireRun(deps, runId)
    const sub = (await deps.store.listSubmissions(run.id)).find(
        (item) => item.caseId === caseId && item.kind === "portal_upload" && item.status === "ready_for_portal"
    )
    if (!sub?.signedXml) throw new CertificationError("NOT_READY", "The signed document is not available for download.")
    deps.log("download", { tipoEcf: sub.tipoEcf })
    return { fileName: `${sub.caseId}.xml`, signedXml: sub.signedXml }
}

/** Authenticates against DGII with the stored certificate; sends no document. */
export async function authCheck(deps: RunDeps, environment: RunEnvironment): Promise<void> {
    const sign = await deps.loadSigner(environment)
    await deps.dgii(environment).authenticate((seed) => sign(seed, "SemillaModel"))
}
