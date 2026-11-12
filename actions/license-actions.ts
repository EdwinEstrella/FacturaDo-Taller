"use server"

import { getCurrentUser, requireAuth } from "@/actions/auth-actions"
import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"

export type LicenseState = "OK" | "GRACE" | "LOCKED"

export type LicenseStatusResult = {
  state: LicenseState
  period?: string
  dueDate?: string
  graceUntil?: string
  daysLeft?: number
}

export type RedeemResult = {
  success: boolean
  error?: string
}

/**
 * Checks the current license status evaluated server-side by the database.
 * Fails open ({ state: "OK" }) on any error so database interruptions do not lock users out.
 */
export async function getLicenseStatus(): Promise<LicenseStatusResult> {
  try {
    const insforge = createServerClient()
    const { data, error } = await insforge.database.rpc("license_status")

    if (error || !data) {
      console.error("Error fetching license status:", error)
      return { state: "OK" }
    }

    const payload = typeof data === "string" ? JSON.parse(data) : data

    return {
      state: payload.state ?? "OK",
      period: payload.period ?? undefined,
      dueDate: payload.due_date ?? payload.dueDate ?? undefined,
      graceUntil: payload.grace_until ?? payload.graceUntil ?? undefined,
      daysLeft: typeof payload.days_left === "number" ? payload.days_left : undefined,
    }
  } catch (err) {
    console.error("Exception fetching license status, failing open:", err)
    return { state: "OK" }
  }
}

/**
 * Redeems an activation code submitted by the user.
 */
export async function redeemPaymentCode(code: string): Promise<RedeemResult> {
  await requireAuth()

  const user = await getCurrentUser()
  const paidBy = user?.username || user?.name || "usuario"

  if (!code || typeof code !== "string") {
    return { success: false, error: "Por favor ingresa un código de pago." }
  }

  const trimmed = code.trim()
  if (trimmed.length === 0) {
    return { success: false, error: "El código no puede estar vacío." }
  }

  if (trimmed.length > 32) {
    return { success: false, error: "El código ingresado es demasiado largo." }
  }

  try {
    const insforge = createServerClient()
    const { data, error } = await insforge.database.rpc("redeem_license_code", {
      p_code: trimmed,
      p_user: paidBy,
    })

    if (error) {
      console.error("RPC error during redeem_license_code:", error)
      return { success: false, error: "Error al validar el código. Inténtalo de nuevo." }
    }

    const result = typeof data === "string" ? JSON.parse(data) : data

    if (!result?.ok) {
      const errorCode = result?.error
      if (errorCode === "INVALID_CODE") {
        return { success: false, error: "Código incorrecto. Verifícalo e inténtalo de nuevo." }
      }
      if (errorCode === "TOO_MANY_ATTEMPTS") {
        return { success: false, error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo." }
      }
      if (errorCode === "NO_PENDING") {
        return { success: false, error: "No hay ningún pago pendiente." }
      }
      return { success: false, error: "Error al validar el código. Inténtalo de nuevo." }
    }

    revalidatePath("/", "layout")
    return { success: true }
  } catch (err) {
    console.error("Exception in redeemPaymentCode:", err)
    return { success: false, error: "Error de servidor al validar el código." }
  }
}
