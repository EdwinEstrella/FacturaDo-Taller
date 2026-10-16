"use client"

import { useEffect, useState } from "react"
import { ArrowUpCircle, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { UpdateInfo, DownloadProgress } from "@/types/electron"

type UpdatePhase = "idle" | "available" | "downloading" | "ready" | "installing"

export function TitlebarUpdateButton() {
    const [phase, setPhase] = useState<UpdatePhase>("idle")
    const [version, setVersion] = useState<string>("")
    const [percent, setPercent] = useState<number>(0)

    useEffect(() => {
        if (typeof window === "undefined" || !window.electron) return

        // Consultar estado inicial
        window.electron.getUpdateState?.().then((state) => {
            if (!state) return
            if (state.phase === "ready") {
                setPhase("ready")
                setVersion(state.downloadedVersion || state.remoteVersion || "")
            } else if (state.phase === "downloading") {
                setPhase("downloading")
                setPercent(state.percent || 0)
                setVersion(state.remoteVersion || "")
            } else if (state.phase === "available") {
                setPhase("available")
                setVersion(state.remoteVersion || "")
            }
        })

        const unsubAvailable = window.electron.onUpdateAvailable?.((info: UpdateInfo) => {
            setPhase("available")
            setVersion(info.version)
        })

        const unsubProgress = window.electron.onDownloadProgress?.((progress: DownloadProgress) => {
            setPhase("downloading")
            setPercent(progress.percent)
        })

        const unsubDownloaded = window.electron.onUpdateDownloaded?.((info: UpdateInfo) => {
            setPhase("ready")
            setVersion(info.version)
            setPercent(100)
        })

        const unsubError = window.electron.onUpdateError?.(() => {
            setPhase("idle")
        })

        return () => {
            unsubAvailable?.()
            unsubProgress?.()
            unsubDownloaded?.()
            unsubError?.()
        }
    }, [])

    if (phase === "idle") return null

    const handleInstall = () => {
        setPhase("installing")
        if (window.electron?.installUpdate) {
            window.electron.installUpdate()
        }
    }

    if (phase === "downloading") {
        return (
            <Button
                size="sm"
                variant="outline"
                className="border-emerald-500 text-emerald-700 bg-emerald-50/80 flex items-center gap-1.5 cursor-wait"
                disabled
                title={`Descargando actualización${version ? ` v${version}` : ""}: ${percent}%`}
            >
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>Actualizando ({percent}%)</span>
            </Button>
        )
    }

    if (phase === "installing") {
        return (
            <Button
                size="sm"
                variant="outline"
                className="border-emerald-600 text-emerald-700 bg-emerald-50/80 flex items-center gap-1.5 cursor-wait"
                disabled
            >
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>Instalando...</span>
            </Button>
        )
    }

    // "ready" o "available"
    return (
        <Button
            size="sm"
            onClick={handleInstall}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm flex items-center gap-1.5 transition-all"
            title={version ? `Actualización v${version} lista. Haz clic para reiniciar e instalar.` : "Actualización lista para instalar"}
        >
            {phase === "ready" ? (
                <Sparkles className="w-4 h-4 text-emerald-200 animate-pulse" />
            ) : (
                <ArrowUpCircle className="w-4 h-4" />
            )}
            <span>Actualizar</span>
        </Button>
    )
}
