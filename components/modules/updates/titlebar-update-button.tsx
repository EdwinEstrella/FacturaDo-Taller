"use client"

import { AlertTriangle, Download, RefreshCw, RotateCw } from "lucide-react"
import type { useAppUpdate } from "@/hooks/use-app-update"

/** Control de actualización de la barra superior. Solo aparece cuando hay algo que hacer. */
export function TitlebarUpdateButton({ update }: { update: ReturnType<typeof useAppUpdate> }) {
    const { phase, newVersion, percent, error, install, check } = update
    const v = newVersion ? ` v${newVersion}` : ""

    if (phase === "available" || phase === "downloading") {
        return (
            <div
                className="flex h-9 items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-800"
                title={`Descargando la versión${v} en segundo plano`}
            >
                <Download className="size-4 text-blue-600" />
                <span className="hidden sm:inline">Descargando{v}</span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-blue-100">
                    <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.max(percent, 4)}%` }} />
                </div>
                <span className="tabular-nums">{percent}%</span>
            </div>
        )
    }

    if (phase === "ready") {
        return (
            <button
                type="button"
                onClick={install}
                className="relative flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white shadow-sm shadow-emerald-900/20 transition hover:bg-emerald-700"
                title={`La versión${v} ya está descargada. El sistema se reinicia en segundos.`}
            >
                <span className="absolute -right-1 -top-1 flex size-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full border-2 border-white bg-emerald-400" />
                </span>
                <RotateCw className="size-4" />
                Reiniciar y actualizar
            </button>
        )
    }

    if (phase === "installing") {
        return (
            <div className="flex h-9 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-sm font-medium text-emerald-800">
                <RefreshCw className="size-4 animate-spin" />
                Reiniciando...
            </div>
        )
    }

    if (phase === "error") {
        return (
            <button
                type="button"
                onClick={check}
                className="flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
                title={error || "No se pudo descargar la actualización"}
            >
                <AlertTriangle className="size-4" />
                <span className="hidden sm:inline">Actualización falló ·</span> Reintentar
            </button>
        )
    }

    return null
}
