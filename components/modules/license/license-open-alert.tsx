"use client"

import * as React from "react"
import { AlertTriangle, KeyRound } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PaymentCodeDialog } from "@/components/modules/license/payment-code-dialog"
import { formatCurrency } from "@/lib/utils"
import type { LicenseStatusResult } from "@/actions/license-actions"

interface LicenseOpenAlertProps {
  license: LicenseStatusResult
}

function getDismissalKey(period?: string): string {
  return `license-alert-dismissed-${period || "current"}`
}

function isDismissedThisSession(period?: string): boolean {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return false
    return window.sessionStorage.getItem(getDismissalKey(period)) === "true"
  } catch {
    return false
  }
}

function markDismissedThisSession(period?: string): void {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem(getDismissalKey(period), "true")
    }
  } catch {
    // Fail silently if sessionStorage is blocked or unavailable
  }
}

function formatDayMonth(dateStr?: string): string {
  if (!dateStr) return ""
  const parts = dateStr.split("-")
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`
  }
  return dateStr
}

export function LicenseOpenAlert({ license }: LicenseOpenAlertProps) {
  const [alertOpen, setAlertOpen] = React.useState(false)
  const [codeDialogOpen, setCodeDialogOpen] = React.useState(false)

  // Automatically open on mount when in GRACE state and not dismissed this session
  React.useEffect(() => {
    if (license.state === "GRACE" && !isDismissedThisSession(license.period)) {
      setAlertOpen(true)
    }
  }, [license.state, license.period])

  if (license.state !== "GRACE") {
    return null
  }

  const handleDismiss = () => {
    markDismissedThisSession(license.period)
    setAlertOpen(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleDismiss()
    } else {
      setAlertOpen(true)
    }
  }

  const handleOpenPaymentDialog = () => {
    // Close this alert and open PaymentCodeDialog without stacking dialogs
    markDismissedThisSession(license.period)
    setAlertOpen(false)
    setCodeDialogOpen(true)
  }

  const dueFormatted = formatDayMonth(license.dueDate) || "11"
  const graceFormatted = formatDayMonth(license.graceUntil) || "14"
  const amountStr = license.amount != null ? ` (${formatCurrency(license.amount)})` : ""

  return (
    <>
      <Dialog open={alertOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-md border-amber-500/40 bg-white dark:bg-slate-900 shadow-2xl"
          showCloseButton={true}
        >
          <DialogHeader className="gap-2 sm:text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                Pago mensual pendiente
              </DialogTitle>
            </div>

            <DialogDescription className="space-y-3 pt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <span className="block font-medium text-slate-800 dark:text-slate-200">
                Tu pago de la suscripción{amountStr} venció el {dueFormatted}. Tienes hasta el {graceFormatted} para pagar; después de esa fecha el sistema se bloqueará.
              </span>
              <span className="block text-slate-500 dark:text-slate-400">
                Si ya pagaste, pega el código de pago que te envió el proveedor.
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleDismiss}
              className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Recordármelo luego
            </Button>
            <Button
              type="button"
              onClick={handleOpenPaymentDialog}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
            >
              <KeyRound className="mr-1.5 h-4 w-4" />
              Pegar código de pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentCodeDialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen} />
    </>
  )
}
