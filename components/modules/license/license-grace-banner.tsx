"use client"

import * as React from "react"
import { AlertTriangle, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PaymentCodeDialog } from "@/components/modules/license/payment-code-dialog"
import { formatCurrency } from "@/lib/utils"
import type { LicenseStatusResult } from "@/actions/license-actions"

interface LicenseGraceBannerProps {
  license: LicenseStatusResult
}

export function LicenseGraceBanner({ license }: LicenseGraceBannerProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)

  // Format grace date as DD/MM
  const formattedDate = React.useMemo(() => {
    if (!license.graceUntil) return ""
    const parts = license.graceUntil.split("-")
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`
    }
    return license.graceUntil
  }, [license.graceUntil])

  const message = React.useMemo(() => {
    const days = license.daysLeft ?? 0
    const dateSuffix = formattedDate ? ` (hasta el ${formattedDate})` : ""
    const amountStr = license.amount != null ? ` (${formatCurrency(license.amount)})` : ""

    if (days <= 0) {
      return `Pago pendiente${amountStr}: hoy es el último día de gracia${dateSuffix}.`
    }
    if (days === 1) {
      return `Pago pendiente${amountStr}: te queda 1 día de gracia${dateSuffix}.`
    }
    return `Pago pendiente${amountStr}: te quedan ${days} días de gracia${dateSuffix}.`
  }, [license.daysLeft, license.amount, formattedDate])

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-200 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="truncate">{message}</span>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setDialogOpen(true)}
          className="shrink-0 border-amber-500/40 bg-white/70 hover:bg-white text-amber-950 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 dark:text-amber-100 dark:border-amber-500/50 h-8 text-xs font-semibold"
        >
          <KeyRound className="mr-1.5 h-3.5 w-3.5" />
          Pegar código de pago
        </Button>
      </div>

      <PaymentCodeDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
