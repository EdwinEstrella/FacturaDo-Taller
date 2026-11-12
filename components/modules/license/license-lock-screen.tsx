"use client"

import * as React from "react"
import { KeyRound, Lock, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PaymentCodeDialog } from "@/components/modules/license/payment-code-dialog"
import { logout } from "@/actions/auth-actions"
import { formatCurrency } from "@/lib/utils"

interface LicenseLockScreenProps {
  amount?: number
}

export function LicenseLockScreen({ amount }: LicenseLockScreenProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } catch {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-inner">
          <Lock className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-3">
          Pago pendiente — sistema bloqueado
        </h1>

        {amount != null && (
          <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-rose-500/10 px-4 py-1.5 text-sm font-semibold text-rose-300 border border-rose-500/20">
            Monto pendiente: {formatCurrency(amount)}
          </div>
        )}

        <p className="text-sm leading-relaxed text-slate-400 mb-8">
          El período de gracia para tu suscripción mensual ha concluido. Para restaurar el acceso al sistema, comunícate con el proveedor del servicio tras confirmar tu pago e ingresa el código de activación correspondiente.
        </p>

        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            onClick={() => setDialogOpen(true)}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Pegar código de pago
          </Button>

          <Button
            variant="ghost"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full text-slate-400 hover:text-white hover:bg-slate-800 h-10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
          </Button>
        </div>
      </div>

      <PaymentCodeDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
