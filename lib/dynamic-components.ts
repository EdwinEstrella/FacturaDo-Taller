/**
 * Utilidades para optimizar la carga de componentes pesados
 * Usa next/dynamic para lazy loading de componentes
 */

import dynamic from "next/dynamic"
import { ComponentType } from "react"

/**
 * Carga un componente de forma dinámica con loading state
 * Útil para componentes pesados que no se necesitan inmediatamente
 */
export function dynamicImport<T extends object>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  fallback?: React.ReactNode
) {
  return dynamic(importFn, {
    loading: () => fallback || null,
    ssr: true,
  })
}

/**
 * Carga un componente solo en el cliente (sin SSR)
 * Útil para componentes que usan APIs del browser
 */
export function clientOnly<T extends object>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  fallback?: React.ReactNode
) {
  return dynamic(importFn, {
    loading: () => fallback || null,
    ssr: false,
  })
}
