// SERVER ONLY. InsForge-backed RunStore. The certification tables hold signed XML and are not
// granted to the app's anon key, so this uses the server-side admin key.

import { createClient } from "@insforge/sdk"
import {
    type PlannedSubmission,
    type Run,
    type RunStatus,
    type RunStore,
    SequenceConflictError,
    type RunType,
    type Submission,
    type SubmissionPatch,
} from "./run"

const RUN_COLUMNS = "id, environment, runType, status, createdAt"
const SUBMISSION_COLUMNS =
    "id, caseId, encf, tipoEcf, kind, sequenceOrder, dependsOnCaseId, status, trackId, dgiiMessages, unsignedXml, signedXml, securityCode, attempts, sourceCaseId"
/** Kinds that carry an e-NCF issued by the business (an ACECF carries the DGII emitter's). */
const ISSUED_KINDS = ["ecf", "rfce", "portal_upload"]
const MAX_ISSUED_ROWS = 10_000
const RUN_TYPES: RunType[] = ["test_set", "commercial_approval", "simulation"]

function fail(operation: string): never {
    throw new Error(`Certification store operation failed: ${operation}`)
}

function adminClient() {
    const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL
    const adminKey = process.env.INSFORGE_ADMIN_KEY
    if (!baseUrl || !adminKey) fail("server not configured")
    return createClient({ baseUrl, anonKey: adminKey, isServerMode: true })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRun(row: any): Run {
    return {
        id: row.id,
        environment: row.environment,
        runType: RUN_TYPES.includes(row.runType) ? row.runType : "test_set",
        status: row.status,
        createdAt: row.createdAt,
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSubmission(row: any): Submission {
    return {
        id: row.id,
        caseId: row.caseId,
        encf: row.encf,
        tipoEcf: row.tipoEcf,
        kind: row.kind,
        sequenceOrder: row.sequenceOrder,
        dependsOnCaseId: row.dependsOnCaseId,
        status: row.status,
        trackId: row.trackId,
        messages: Array.isArray(row.dgiiMessages) ? row.dgiiMessages : [],
        unsignedXml: row.unsignedXml,
        signedXml: row.signedXml,
        securityCode: row.securityCode,
        attempts: row.attempts,
        sourceCaseId: typeof row.sourceCaseId === "string" ? row.sourceCaseId : null,
    }
}

function toColumns(patch: SubmissionPatch): Record<string, unknown> {
    const out: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (patch.status !== undefined) out.status = patch.status
    if (patch.trackId !== undefined) out.trackId = patch.trackId
    if (patch.messages !== undefined) out.dgiiMessages = patch.messages
    if (patch.signedXml !== undefined) out.signedXml = patch.signedXml
    if (patch.signedSha256 !== undefined) out.signedSha256 = patch.signedSha256
    if (patch.securityCode !== undefined) out.securityCode = patch.securityCode
    if (patch.attempts !== undefined) out.attempts = patch.attempts
    return out
}

export function createInsforgeRunStore(): RunStore {
    const db = adminClient().database

    return {
        async createRun(input) {
            const { data: run, error } = await db
                .from("EcfCertificationRun")
                .insert([
                    {
                        environment: input.environment,
                        runType: input.runType,
                        sourceSha256: input.sourceSha256,
                        createdBy: input.createdBy,
                        status: "pending",
                    },
                ])
                .select(RUN_COLUMNS)
            if (error || !run?.[0]) fail("createRun")

            const runId = run[0].id as string
            const rows = input.submissions.map((sub: PlannedSubmission) => ({
                runId,
                caseId: sub.caseId,
                encf: sub.encf,
                tipoEcf: sub.tipoEcf,
                kind: sub.kind,
                sequenceOrder: sub.sequenceOrder,
                dependsOnCaseId: sub.dependsOnCaseId,
                unsignedXml: sub.unsignedXml,
                ...(sub.sourceCaseId ? { sourceCaseId: sub.sourceCaseId } : {}),
            }))
            const { error: insertError } = await db.from("EcfCertificationSubmission").insert(rows)
            if (insertError) {
                await db.from("EcfCertificationRun").delete().eq("id", runId)
                // 23505: the unique / issued-e-NCF guard of the simulation migration.
                if (insertError.code === "23505" || /already issued|duplicate key/i.test(String(insertError.message ?? ""))) {
                    throw new SequenceConflictError()
                }
                fail("createSubmissions")
            }
            return toRun(run[0])
        },

        async getRun(runId) {
            const { data, error } = await db.from("EcfCertificationRun").select(RUN_COLUMNS).eq("id", runId).limit(1)
            if (error) fail("getRun")
            return data?.[0] ? toRun(data[0]) : null
        },

        async issuedEncfs(environment) {
            const { data, error } = await db
                .from("EcfCertificationSubmission")
                .select("encf")
                .eq("environment", environment)
                .in("kind", ISSUED_KINDS)
                .in("runType", ["test_set", "simulation"])
                .order("encf", { ascending: false })
                .limit(MAX_ISSUED_ROWS)
            if (error) fail("issuedEncfs")
            const rows = data ?? []
            // Fail closed rather than allocate from a truncated history.
            if (rows.length >= MAX_ISSUED_ROWS) fail("issuedEncfs:truncated")
            return rows.map((row: { encf: string }) => row.encf)
        },

        async latestRun(environment, runType) {
            const { data, error } = await db
                .from("EcfCertificationRun")
                .select(RUN_COLUMNS)
                .eq("environment", environment)
                .eq("runType", runType)
                .order("createdAt", { ascending: false })
                .limit(1)
            if (error) fail("latestRun")
            return data?.[0] ? toRun(data[0]) : null
        },

        async listSubmissions(runId) {
            const { data, error } = await db
                .from("EcfCertificationSubmission")
                .select(SUBMISSION_COLUMNS)
                .eq("runId", runId)
                .order("sequenceOrder", { ascending: true })
            if (error) fail("listSubmissions")
            return (data ?? []).map(toSubmission)
        },

        async updateSubmission(id, patch, expected) {
            let query = db.from("EcfCertificationSubmission").update(toColumns(patch)).eq("id", id)
            if (expected) query = query.eq("status", expected.status).eq("attempts", expected.attempts)
            const { data, error } = await query.select("id")
            if (error) fail("updateSubmission")
            return Array.isArray(data) && data.length > 0
        },

        async setRunStatus(runId, status: RunStatus) {
            const { error } = await db
                .from("EcfCertificationRun")
                .update({ status, updatedAt: new Date().toISOString() })
                .eq("id", runId)
            if (error) fail("setRunStatus")
        },
    }
}
