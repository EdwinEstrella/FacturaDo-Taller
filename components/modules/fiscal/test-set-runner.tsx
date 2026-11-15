"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Download, FileKey2, Loader2, RefreshCw, Send, Square, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
    checkDgiiConnection,
    downloadCertificationDocument,
    getLatestCertificationRun,
    refreshCertificationRun,
    sendCertificationBatch,
    startCertificationRun,
    type RunActionResult,
} from "@/actions/ecf-certification-actions"
import {
    KIND_LABELS,
    STATUS_LABELS,
    describeProgress,
    describeRunError,
    nextLoopAction,
    portalDownloads,
    shouldAutoPoll,
    statusTone,
    summariesAccepted,
    validateTestSetFile,
    type RunView,
    type StatusTone,
} from "@/lib/fiscal/shared/certification-run"

const POLL_DELAY_MS = 5000
const MAX_POLL_ROUNDS = 60

const TONE_CLASSES: Record<StatusTone, string> = {
    neutral: "bg-slate-100 text-slate-600",
    progress: "bg-sky-100 text-sky-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function saveXml(fileName: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: "application/xml;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}

type Busy = "auth" | "start" | "send" | "status" | "download" | null

export function TestSetRunner() {
    const [file, setFile] = useState<File | null>(null)
    const [run, setRun] = useState<RunView | null>(null)
    const [busy, setBusy] = useState<Busy>(null)
    const [status, setStatus] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null)
    const stopRef = useRef(false)
    const autoPollRounds = useRef(0)
    const prevRunId = useRef<string | null>(null)

    const apply = useCallback((result: RunActionResult): RunView | null => {
        if (!result.success) {
            setStatus({ kind: "error", text: result.error })
            return null
        }
        setRun(result.run)
        return result.run
    }, [])

    useEffect(() => {
        let cancelled = false
        void getLatestCertificationRun().then((result) => {
            if (!cancelled && result.success && result.run) setRun(result.run)
        })
        return () => {
            cancelled = true
        }
    }, [])

    const poll = useCallback(
        async (runId: string) => apply(await refreshCertificationRun(runId)),
        [apply]
    )

    // Documents sent to DGII are polled automatically until they resolve.
    useEffect(() => {
        if (run?.runId !== prevRunId.current) {
            prevRunId.current = run?.runId ?? null
            autoPollRounds.current = 0
        }
        if (!run || busy !== null || !shouldAutoPoll(run, autoPollRounds.current, MAX_POLL_ROUNDS)) return
        let cancelled = false
        const timer = setTimeout(() => {
            if (cancelled) return
            autoPollRounds.current++
            void poll(run.runId).then((result) => {
                if (!cancelled && !result) autoPollRounds.current = MAX_POLL_ROUNDS
            })
        }, POLL_DELAY_MS)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [run, busy, poll])

    const selectFile = (selected: File | null) => {
        setStatus(null)
        if (!selected) return setFile(null)
        const problem = validateTestSetFile(selected)
        if (problem) {
            setFile(null)
            setStatus({ kind: "error", text: problem })
            return
        }
        setFile(selected)
    }

    const checkConnection = async () => {
        setBusy("auth")
        setStatus({ kind: "info", text: "Probando la conexión con la DGII..." })
        const result = await checkDgiiConnection()
        setStatus(
            result.success
                ? { kind: "success", text: "Conexión con la DGII correcta: tu certificado fue aceptado. No se envió ningún documento." }
                : { kind: "error", text: result.error }
        )
        setBusy(null)
    }

    const start = async () => {
        if (!file) return
        setBusy("start")
        setStatus(null)
        const formData = new FormData()
        formData.set("workbook", file)
        const loaded = apply(await startCertificationRun(formData))
        if (loaded) setStatus({ kind: "success", text: `Set de Pruebas cargado: ${loaded.items.length} documentos listos para enviar.` })
        autoPollRounds.current = 0
        setBusy(null)
    }

    const sendAll = async () => {
        if (!run) return
        stopRef.current = false
        setBusy("send")
        setStatus({ kind: "info", text: "Enviando documentos a la DGII..." })
        try {
            let pollRounds = 0
            while (!stopRef.current) {
                const result = await sendCertificationBatch(run.runId)
                const current = apply(result)
                if (!current) return
                const action = nextLoopAction(current)
                if (action === "stop") return setStatus({ kind: "error", text: describeRunError(current.stoppedReason ?? undefined) })
                if (action === "done") {
                    await poll(run.runId)
                    return setStatus({ kind: "success", text: "Todos los documentos fueron enviados. Consulta el estado hasta que la DGII termine de procesarlos." })
                }
                if (action === "poll") {
                    if (++pollRounds > MAX_POLL_ROUNDS) {
                        return setStatus({ kind: "info", text: "La DGII sigue procesando documentos. Consulta el estado más tarde y vuelve a enviar." })
                    }
                    setStatus({ kind: "info", text: "Esperando que la DGII acepte el documento referenciado por una nota..." })
                    await wait(POLL_DELAY_MS)
                    if (stopRef.current) break
                    if (!(await poll(run.runId))) return
                }
            }
            setStatus({ kind: "info", text: "Envío detenido. Puedes continuar cuando quieras." })
        } finally {
            autoPollRounds.current = 0
            setBusy(null)
        }
    }

    const refreshStatus = async () => {
        if (!run) return
        setBusy("status")
        const updated = await poll(run.runId)
        if (updated) setStatus({ kind: "success", text: describeProgress(updated) })
        autoPollRounds.current = 0
        setBusy(null)
    }

    const download = async (caseId: string, encf: string) => {
        if (!run) return
        setBusy("download")
        const result = await downloadCertificationDocument(run.runId, caseId)
        if (result.success) saveXml(`${encf}.xml`, result.run.signedXml)
        else setStatus({ kind: "error", text: result.error })
        setBusy(null)
    }

    const downloads = run ? portalDownloads(run) : []

    return (
        <div className="space-y-4 rounded-xl border border-dashed border-blue-300 bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <FileKey2 className="size-4 text-blue-600" /> Set de Pruebas de la DGII (.xlsx)
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
                Descarga el Excel del Set de Pruebas desde el portal de la DGII y cárgalo aquí. El sistema arma cada e-CF y RFCE, los firma con tu certificado y los envía a la DGII en el orden correcto.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="max-w-xs"
                    onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" disabled={!file || busy !== null} onClick={() => void start()} className="sm:ml-auto">
                    {busy === "start" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                    {busy === "start" ? "Procesando..." : "Cargar Set"}
                </Button>
            </div>

            {run && (
                <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <p className="text-xs font-semibold text-slate-800">{describeProgress(run)}</p>
                        <div className="flex gap-2 sm:ml-auto">
                            {busy === "send" ? (
                                <Button type="button" variant="outline" onClick={() => { stopRef.current = true }}>
                                    <Square className="mr-2 size-4" /> Detener
                                </Button>
                            ) : (
                                <Button type="button" disabled={busy !== null || run.sendComplete} onClick={() => void sendAll()}>
                                    <Send className="mr-2 size-4" /> Enviar a la DGII
                                </Button>
                            )}
                            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void refreshStatus()}>
                                <RefreshCw className="mr-2 size-4" /> {busy === "status" ? "Consultando..." : "Consultar estado"}
                            </Button>
                        </div>
                    </div>

                    <div className="max-h-96 overflow-auto rounded-xl border bg-white">
                        <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-3 py-2">#</th>
                                    <th className="px-3 py-2">e-NCF</th>
                                    <th className="px-3 py-2">Tipo</th>
                                    <th className="px-3 py-2">Envío</th>
                                    <th className="px-3 py-2">Estado</th>
                                    <th className="px-3 py-2">Mensajes DGII</th>
                                </tr>
                            </thead>
                            <tbody>
                                {run.items.map((item) => (
                                    <tr key={`${item.caseId}-${item.kind}`} className="border-t align-top">
                                        <td className="px-3 py-2 text-slate-500">{item.sequenceOrder + 1}</td>
                                        <td className="px-3 py-2 font-mono">{item.encf}</td>
                                        <td className="px-3 py-2">E{item.tipoEcf}</td>
                                        <td className="px-3 py-2">{KIND_LABELS[item.kind]}</td>
                                        <td className="px-3 py-2">
                                            <span className={cn("rounded-full px-2 py-0.5 font-bold", TONE_CLASSES[statusTone(item.status)])}>
                                                {STATUS_LABELS[item.status]}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-500">
                                            {item.messages.map((m) => (m.codigo ? `${m.codigo}: ${m.valor}` : m.valor)).join(" · ") || "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {downloads.length > 0 && (
                        <div className="rounded-xl border bg-white p-4">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                                <Download className="size-4 text-blue-600" /> Facturas de consumo menores a 250 mil
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                Sube estas facturas en el portal (Facturas de consumo &lt; 250Mil) cuando los resúmenes estén aceptados.
                                {summariesAccepted(run) ? " Los resúmenes ya fueron aceptados." : " Todavía hay resúmenes sin aceptar."}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {downloads.map((item) => (
                                    <Button
                                        key={item.caseId}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={busy !== null}
                                        onClick={() => void download(item.caseId, item.encf)}
                                    >
                                        <Download className="mr-2 size-3.5" /> {item.encf}.xml
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void checkConnection()} className="w-full">
                {busy === "auth" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
                {busy === "auth" ? "Probando..." : "Probar conexión con la DGII"}
            </Button>

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
