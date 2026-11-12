"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Clipboard, KeyRound, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { redeemPaymentCode } from "@/actions/license-actions"

interface PaymentCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentCodeDialog({ open, onOpenChange }: PaymentCodeDialogProps) {
  const router = useRouter()
  const [code, setCode] = React.useState("")
  const [isPending, setIsPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear timer helper
  const clearCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  // Reset state and clear timer whenever dialog closes or on unmount
  React.useEffect(() => {
    if (!open) {
      clearCloseTimer()
      setCode("")
      setError(null)
      setSuccess(false)
      setIsPending(false)
    }

    return () => {
      clearCloseTimer()
    }
  }, [open, clearCloseTimer])

  const handlePasteFromClipboard = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText()
        if (text) {
          const cleaned = text.trim().toUpperCase()
          setCode(cleaned)
          setError(null)
        }
      }
    } catch {
      // Silently ignore clipboard denial
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")
    setCode(rawVal)
    if (error) setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) {
      setError("Por favor ingresa o pega el código de pago.")
      return
    }

    setIsPending(true)
    setError(null)

    try {
      const res = await redeemPaymentCode(trimmed)
      if (res.success) {
        setSuccess(true)
        clearCloseTimer()
        closeTimerRef.current = setTimeout(() => {
          closeTimerRef.current = null
          onOpenChange(false)
          router.refresh()
        }, 1200)
      } else {
        setError(res.error || "Código incorrecto.")
      }
    } catch {
      setError("Error de comunicación. Inténtalo de nuevo.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <DialogTitle>Pegar código de pago</DialogTitle>
          </div>
          <DialogDescription>
            Ingresa el código proporcionado tras realizar el pago mensual para mantener el sistema activado.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 animate-in zoom-in-75 duration-300" />
            <p className="mt-3 text-base font-semibold text-emerald-700 dark:text-emerald-400">
              ¡Pago validado exitosamente!
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              El sistema se actualizará automáticamente.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  autoFocus
                  placeholder="XXXX-XXXX"
                  value={code}
                  onChange={handleInputChange}
                  disabled={isPending}
                  maxLength={32}
                  className="font-mono text-center text-lg uppercase tracking-wider h-12"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handlePasteFromClipboard}
                  disabled={isPending}
                  className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
                >
                  <Clipboard className="mr-1.5 h-3.5 w-3.5" />
                  Pegar desde el portapapeles
                </Button>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !code.trim()}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  "Validar código"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
