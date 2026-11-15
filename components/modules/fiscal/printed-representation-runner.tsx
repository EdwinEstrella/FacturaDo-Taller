"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Copy, Download, FileText, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { downloadCertificationDocument, getLatestCertificationRun } from "@/actions/ecf-certification-actions"
import type { RunView } from "@/lib/fiscal/shared/certification-run"
import { pickPrintedSlots } from "@/lib/fiscal/printed/representation"
import {
    MISSING_SLOT_MESSAGE,
    PORTAL_MAX_BYTES,
    buildPrintedDocument,
    formatBytes,
    totalBytes,
    type PrintedDocument,
} from "@/lib/fiscal/printed/documents"

/** Pause between sequential downloads so the browser does not drop any of them. */
const DOWNLOAD_GAP_MS = 400
/** Printed representations are built from the simulation run, which uses the certification environment. */
const ENVIRONMENT = "certification" as const

type SlotResult = { document: PrintedDocument; error?: undefined } | { document?: undefined; error: string }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function savePdf(document: PrintedDocument) {
    const url = URL.createObjectURL(new Blob([document.bytes as BlobPart], { type: "application/pdf" }))
    const link = window.document.createElement("a")
    link.href = url
    link.download = document.fileName
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}

/**
 * Certification step 5: builds the printed representation (PDF with the DGII QR) of one accepted
 * e-CF of the step-4 simulation per portal slot, exactly as signed, to upload to the DGII portal.
 */
export function PrintedRepresentationRunner() {
    const [run, setRun] = useState<RunView | null>(null)
    const [loading, setLoading] = useState(false)
    const [busy, setBusy] = useState<"generate" | "download" | null>(null)
    const [results, setResults] = useState<Record<string, SlotResult>>({})
    const [status, setStatus] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null)

    const loadRun = useCallback(async () => {
        setLoading(true)
        const result = await getLatestCertificationRun("simulation")
        if (!result.success) setStatus({ kind: "error", text: result.error })
        else {
            setRun(result.run)
            setResults({})
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        void loadRun()
    }, [loadRun])

    const picks = run ? pickPrintedSlots(run.items) : []
    const available = picks.filter((pick) => pick.item)
    const documents = picks.map((pick) => results[pick.slot.inputName]?.document).filter((document): document is PrintedDocument => !!document)
    const size = totalBytes(documents)

    const generate = async () => {
        if (!run) return
        setBusy("generate")
        setStatus({ kind: "info", text: "Generando las representaciones impresas..." })
        const next: Record<string, SlotResult> = {}
        try {
            for (const { slot, item } of available) {
                const download = await downloadCertificationDocument(run.runId, item!.caseId)
                if (!download.success) {
                    next[slot.inputName] = { error: download.error }
                } else {
                    const outcome = await buildPrintedDocument({
                        slot,
                        signedXml: download.run.signedXml,
                        storedSecurityCode: download.run.securityCode,
                        environment: ENVIRONMENT,
                    })
                    next[slot.inputName] = outcome.ok ? { document: outcome.document } : { error: outcome.message }
                }
                setResults({ ...next })
            }
            const generated = Object.values(next).filter((result) => result.document).length
            const failed = Object.keys(next).length - generated
            const missing = picks.length - available.length
            setStatus({
                kind: failed || missing ? "error" : "success",
                text: `Se generaron ${generated} de ${picks.length} representaciones.${failed ? ` ${failed} con error.` : ""}${missing ? ` Faltan ${missing} tipos en la simulación.` : ""}`,
            })
        } catch {
            setStatus({ kind: "error", text: "No se pudieron generar las representaciones impresas. Inténtalo de nuevo." })
        } finally {
            setBusy(null)
        }
    }

    const downloadAll = async () => {
        setBusy("download")
        try {
            for (const [index, document] of documents.entries()) {
                if (index > 0) await wait(DOWNLOAD_GAP_MS)
                savePdf(document)
            }
            setStatus({ kind: "success", text: `Se descargaron ${documents.length} PDF.` })
        } finally {
            setBusy(null)
        }
    }

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setStatus({ kind: "success", text: "URL del QR copiada." })
        } catch {
            setStatus({ kind: "error", text: "No se pudo copiar la URL." })
        }
    }

    return (
        <div className="space-y-4 rounded-xl border border-dashed border-blue-300 bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <FileText className="size-4 text-blue-600" /> Representaciones impresas para el portal
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
                Por cada casilla del portal, el sistema toma el primer comprobante aceptado de la Simulación e-CF (Paso 4) y genera su PDF tal como fue firmado y enviado, con el QR de validación de la DGII, el código de seguridad y la fecha de firma. Descarga los PDF y sube cada uno en su casilla del portal.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button type="button" disabled={!run || available.length === 0 || busy !== null || loading} onClick={() => void generate()}>
                    {busy === "generate" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileText className="mr-2 size-4" />}
                    {busy === "generate" ? "Generando..." : "Generar representaciones"}
                </Button>
                <Button type="button" variant="outline" disabled={documents.length === 0 || busy !== null} onClick={() => void downloadAll()}>
                    <Download className="mr-2 size-4" /> {busy === "download" ? "Descargando..." : `Descargar todos (${documents.length})`}
                </Button>
                <Button type="button" variant="outline" disabled={busy !== null || loading} onClick={() => void loadRun()} className="sm:ml-auto">
                    <RefreshCw className="mr-2 size-4" /> {loading ? "Buscando..." : "Actualizar simulación"}
                </Button>
            </div>

            {!run && !loading && (
                <div className="rounded-xl border bg-white py-6 text-center text-xs font-semibold text-slate-500">
                    No hay comprobantes de simulación. Genera y envía los del Paso 4 primero.
                </div>
            )}

            {run && (
                <div className="overflow-auto rounded-xl border bg-white">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-3 py-2">Casilla del portal</th>
                                <th className="px-3 py-2">e-NCF</th>
                                <th className="px-3 py-2">Estado</th>
                                <th className="px-3 py-2">QR</th>
                                <th className="px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {picks.map(({ slot, item }) => {
                                const result = results[slot.inputName]
                                return (
                                    <tr key={slot.inputName} className="border-t align-top">
                                        <td className="px-3 py-2">
                                            <div className="font-semibold text-slate-900">{slot.label}</div>
                                            <div className="font-mono text-[10px] text-slate-500">{slot.inputName}</div>
                                        </td>
                                        <td className="px-3 py-2 font-mono">{item?.encf ?? "—"}</td>
                                        <td className="px-3 py-2">
                                            {!item ? (
                                                <span className="text-red-600">{MISSING_SLOT_MESSAGE}</span>
                                            ) : result?.error ? (
                                                <span className="text-red-600">{result.error}</span>
                                            ) : result?.document ? (
                                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">
                                                    Generado · {formatBytes(result.document.bytes.length)}
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600">Pendiente</span>
                                            )}
                                        </td>
                                        <td className="min-w-0 max-w-[28rem] px-3 py-2">
                                            {result?.document && (
                                                <div className="flex items-center gap-1">
                                                    <span title={result.document.qrUrl} className="min-w-0 flex-1 truncate font-mono text-[10px] text-slate-500">
                                                        {result.document.qrUrl}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        aria-label="Copiar URL del QR"
                                                        onClick={() => void copy(result.document!.qrUrl)}
                                                        className="shrink-0 rounded p-1 text-blue-600 hover:bg-blue-50"
                                                    >
                                                        <Copy className="size-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            {result?.document && (
                                                <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => savePdf(result.document!)}>
                                                    <Download className="mr-1.5 size-3.5" /> Descargar PDF
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {documents.length > 0 && (
                <p className={cn("text-xs font-semibold", size > PORTAL_MAX_BYTES ? "text-red-600" : "text-slate-500")}>
                    {size > PORTAL_MAX_BYTES && <AlertTriangle className="mr-1 inline size-3.5" />}
                    Tamaño total: {formatBytes(size)}
                    {size > PORTAL_MAX_BYTES ? " — supera el límite de 10 MB del portal." : " (límite del portal: 10 MB)."}
                </p>
            )}

            {status && (
                <p
                    role="status"
                    className={cn(
                        "text-xs font-semibold",
                        status.kind === "success" ? "text-emerald-600" : status.kind === "error" ? "text-red-600" : "text-slate-500"
                    )}
                >
                    {status.text}
                </p>
            )}
        </div>
    )
}
