/**
 * Componentes de Loading reutilizables
 *
 * Estos componentes wrapper facilitan el uso del TetrisLoading en diferentes contextos.
 *
 * @example Uso básico:
 * ```tsx
 * import { PageLoading, CardLoading, InlineLoading } from "@/components/ui/loading"
 *
 * // Para página completa
 * <PageLoading message="Cargando dashboard..." />
 *
 * // Para tarjetas o modales
 * <CardLoading />
 *
 * // Para espacios pequeños o botones
 * <InlineLoading message="Procesando..." />
 * ```
 */

import TetrisLoading from "./tetris-loader"

/**
 * Loading para páginas completas
 * - Tamaño grande (lg)
 * - Centrado horizontalmente
 * - Muestra texto de carga
 */
export function PageLoading({ message = "Cargando..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <TetrisLoading
        size="lg"
        loadingText={message}
      />
    </div>
  )
}

/**
 * Loading para tarjetas o contenedores medianos
 * - Tamaño mediano (md)
 * - Sin contenedor externo (para usar dentro de Cards)
 * - Sin texto (más compacto)
 */
export function CardLoading() {
  return <TetrisLoading size="md" showLoadingText={false} />
}

/**
 * Loading para espacios pequeños o inline
 * - Tamaño pequeño (sm)
 * - Animación rápida
 * - Sin texto
 */
export function InlineLoading({ message }: { message?: string }) {
  return <TetrisLoading
    size="sm"
    speed="fast"
    loadingText={message}
    showLoadingText={!!message}
  />
}

/**
 * Loading personalizado con todas las opciones disponibles
 */
export { TetrisLoading }
export type { TetrisLoadingProps } from "./tetris-loader"
