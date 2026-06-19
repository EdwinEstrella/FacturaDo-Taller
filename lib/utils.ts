import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
  }).format(value)
}

export function formatQuantity(value: number | string | null | undefined, maxFractionDigits = 2) {
  const numericValue = Number(value ?? 0)

  if (!Number.isFinite(numericValue)) {
    return "0"
  }

  return new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(numericValue) ? 0 : maxFractionDigits,
  }).format(numericValue)
}
