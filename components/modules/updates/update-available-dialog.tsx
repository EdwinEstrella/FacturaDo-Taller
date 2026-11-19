"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import type { useAppUpdate } from "@/hooks/use-app-update"

const SNOOZE_DELAY_MS = 2 * 60 * 60 * 1000 // 2 hours

export interface UpdateAvailableDialogProps {
    update: ReturnType<typeof useAppUpdate>
}

/** In-app modal dialog displayed when a desktop application update is ready to install. */
export function UpdateAvailableDialog({ update }: UpdateAvailableDialogProps) {
    const { phase, newVersion, install } = update
    const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)
    const snoozeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const isInstalling = phase === "installing"
    const isReady = phase === "ready"
    const targetVersion = newVersion || "ready"
    const isDismissed = dismissedVersion === targetVersion

    // Open automatically when ready (or while actively installing), unless dismissed for this version
    const isOpen = (isReady || isInstalling) && !isDismissed

    // Clear snooze timer on unmount
    useEffect(() => {
        return () => {
            if (snoozeTimerRef.current) {
                clearTimeout(snoozeTimerRef.current)
            }
        }
    }, [])

    const handleDismiss = useCallback(() => {
        setDismissedVersion(targetVersion)

        if (snoozeTimerRef.current) {
            clearTimeout(snoozeTimerRef.current)
        }

        // Remind again after 2 hours if still ready
        snoozeTimerRef.current = setTimeout(() => {
            setDismissedVersion(null)
        }, SNOOZE_DELAY_MS)
    }, [targetVersion])

    const handleOpenChange = useCallback(
        (nextOpen: boolean) => {
            if (isInstalling) return
            if (!nextOpen) {
                handleDismiss()
            }
        },
        [isInstalling, handleDismiss]
    )

    const description = newVersion
        ? `La versión ${newVersion} está lista. Se instala en segundos y el sistema se abre solo.`
        : "La nueva versión está lista. Se instala en segundos y el sistema se abre solo."

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md" showCloseButton={!isInstalling}>
                <DialogHeader className="gap-3 text-center sm:text-center">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/15 text-emerald-600">
                        <Sparkles className="size-7" />
                    </div>
                    <DialogTitle className="text-xl font-bold">¡Hay una actualización!</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleDismiss}
                        disabled={isInstalling}
                        className="w-full sm:w-auto"
                    >
                        Más tarde
                    </Button>
                    <Button
                        type="button"
                        onClick={install}
                        disabled={isInstalling}
                        className="w-full sm:w-auto bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                        {isInstalling ? (
                            <>
                                <RefreshCw className="mr-2 size-4 animate-spin" />
                                Actualizando...
                            </>
                        ) : (
                            "Actualizar ahora"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
