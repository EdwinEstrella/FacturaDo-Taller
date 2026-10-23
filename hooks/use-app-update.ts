"use client"

import { useCallback, useEffect, useState } from "react"

export type UpdatePhase = "unsupported" | "idle" | "checking" | "available" | "downloading" | "ready" | "installing" | "error"

export interface AppUpdateState {
    phase: UpdatePhase
    currentVersion: string
    newVersion: string
    percent: number
    error: string
    /** true justo después de una búsqueda manual sin novedades, para confirmar "estás al día". */
    upToDate: boolean
}

/** Estado de actualización de la app de escritorio (Electron). En el navegador queda en "unsupported". */
export function useAppUpdate() {
    const [state, setState] = useState<AppUpdateState>({
        phase: "unsupported",
        currentVersion: "",
        newVersion: "",
        percent: 0,
        error: "",
        upToDate: false,
    })

    useEffect(() => {
        const api = typeof window !== "undefined" ? window.electron : undefined
        if (!api?.getUpdateState) return

        const patch = (p: Partial<AppUpdateState>) => setState((s) => ({ ...s, ...p }))

        api.getUpdateState().then((s) => {
            if (!s) return
            const known = ["idle", "checking", "available", "downloading", "ready", "error"]
            patch({
                phase: (known.includes(s.phase) ? s.phase : "idle") as UpdatePhase,
                currentVersion: s.currentVersion || "",
                newVersion: s.downloadedVersion || s.remoteVersion || "",
                percent: s.percent || 0,
                error: s.error || "",
            })
        })

        const subs = [
            api.onCheckingForUpdate?.(() => patch({ phase: "checking", upToDate: false })),
            api.onUpdateAvailable?.((info) => patch({ phase: "available", newVersion: info.version, percent: 0 })),
            api.onDownloadProgress?.((p) => patch({ phase: "downloading", percent: Math.round(p.percent) })),
            api.onUpdateDownloaded?.((info) => patch({ phase: "ready", newVersion: info.version, percent: 100 })),
            api.onUpdateNotAvailable?.(() => setState((s) => ({ ...s, phase: "idle", upToDate: s.phase === "checking" }))),
            api.onUpdateError?.((error) => setState((s) => s.phase === "ready" ? s : { ...s, phase: "error", error })),
        ]
        return () => subs.forEach((unsub) => unsub?.())
    }, [])

    const check = useCallback(() => {
        setState((s) => ({ ...s, phase: "checking", upToDate: false, error: "" }))
        window.electron?.checkForUpdates?.()
    }, [])

    const install = useCallback(() => {
        setState((s) => ({ ...s, phase: "installing" }))
        window.electron?.installUpdate?.()
    }, [])

    return { ...state, check, install }
}
