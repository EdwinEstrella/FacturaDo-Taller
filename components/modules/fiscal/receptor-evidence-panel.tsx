"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getReceptorEvidence } from "@/actions/ecf-actions"
import { describeReception, type ReceptorEvidence } from "@/lib/fiscal/shared/receptor-evidence"

const formatDate = (value: string) =>
    new Date(value).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "medium" })

/**
 * Certification steps 8-11: shows whether the public receptor (facturado.lat) answers and what the DGII
 * delivered to it, so the step can be confirmed with evidence instead of by hand.
 */
export function ReceptorEvidencePanel({ show }: { show: "documents" | "approvals" }) {
    const [evidence, setEvidence] = useState<ReceptorEvidence | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const apply = useCallback((result: Awaited<ReturnType<typeof getReceptorEvidence>>) => {
        if (result.success) {
            setEvidence(result.evidence)
            setError(null)
        } else {
            setError(result.error)
        }
        setLoading(false)
    }, [])

    const load = useCallback(() => {
        setLoading(true)
        void getReceptorEvidence().then(apply)
    }, [apply])

    useEffect(() => {
        let cancelled = false
        void getReceptorEvidence().then((result) => {
            if (!cancelled) apply(result)
        })
        return () => {
            cancelled = true
        }
    }, [apply])

    return (
        <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Receptor de e-CF</p>
                <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
                    Actualizar
                </Button>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {evidence && (
                <>
                    <div
                        className={cn(
                            "flex items-start gap-2 rounded-md p-3 text-xs leading-relaxed",
                            evidence.online ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                        )}
                    >
                        {evidence.online ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
                        <p>
                            {evidence.online
                                ? "El receptor público responde. Ya puedes iniciar el envío de pruebas en el portal de la DGII."
                                : "El receptor público no responde todavía. No inicies el envío de pruebas en el portal hasta que esté en línea."}
                            <span className="block break-all font-mono text-[11px] opacity-80">{evidence.probeUrl}</span>
                        </p>
                    </div>

                    {show === "documents" ? (
                        <EvidenceTable
                            empty="Todavía no se ha recibido ningún e-CF."
                            headers={["e-NCF", "Emisor", "Resultado", "Fecha"]}
                            rows={evidence.documents.map((doc) => ({
                                id: doc.id,
                                ok: doc.estado === 0,
                                cells: [doc.encf || "—", doc.emisorRnc, describeReception(doc.estado, doc.motivoNoRecibido), formatDate(doc.receivedAt)],
                            }))}
                        />
                    ) : (
                        <EvidenceTable
                            empty="Todavía no se ha recibido ninguna aprobación comercial."
                            headers={["e-NCF", "Comprador", "Resultado", "Fecha"]}
                            rows={evidence.approvals.map((approval) => ({
                                id: approval.id,
                                ok: approval.estado === 1,
                                cells: [
                                    approval.encf,
                                    approval.compradorRnc,
                                    approval.estado === 1 ? "Aprobada" : `Rechazada${approval.detalleMotivoRechazo ? `: ${approval.detalleMotivoRechazo}` : ""}`,
                                    formatDate(approval.receivedAt),
                                ],
                            }))}
                        />
                    )}
                </>
            )}
        </div>
    )
}

function EvidenceTable({ headers, rows, empty }: {
    headers: string[]
    rows: { id: string; ok: boolean; cells: string[] }[]
    empty: string
}) {
    if (rows.length === 0) return <p className="text-xs text-slate-500">{empty}</p>
    return (
        <div className="max-h-72 overflow-auto rounded-md border">
            <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                    <tr>{headers.map((header) => <th key={header} className="px-3 py-2 font-medium">{header}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.id} className="border-t">
                            {row.cells.map((cell, index) => (
                                <td key={index} className={cn("px-3 py-2", index === 2 && (row.ok ? "text-emerald-700" : "text-red-600"))}>
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
