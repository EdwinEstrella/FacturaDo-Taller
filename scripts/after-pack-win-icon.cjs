'use strict'

/**
 * Hook afterPack para Windows:
 * 1. Copia los node_modules del servidor standalone a resources/server/node_modules
 *    (evita que electron-builder los descarte por sus reglas internas de ignorar node_modules).
 * 2. Aplica icon.ico al ejecutable empaquetado usando rcedit sin alterar la firma.
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const fs = require('node:fs')
  const path = require('node:path')
  const { rcedit } = require('rcedit')

  const projectDir = context.packager.info.projectDir

  // 1. Asegurar node_modules en resources/server/
  const standaloneModulesSrc = path.join(projectDir, '.next', 'standalone', 'node_modules')
  const standaloneModulesDest = path.join(context.appOutDir, 'resources', 'server', 'node_modules')

  if (fs.existsSync(standaloneModulesSrc)) {
    if (!fs.existsSync(standaloneModulesDest)) {
      console.log('[after-pack] Copiando módulos de Next.js standalone a resources/server/node_modules...')
      fs.cpSync(standaloneModulesSrc, standaloneModulesDest, { recursive: true })
      console.log('[after-pack] Módulos de Next.js standalone integrados con éxito.')
    }
  } else {
    console.warn('[after-pack] Advertencia: No se encontró .next/standalone/node_modules')
  }

  // 2. Aplicar icono al ejecutable
  const iconPath = path.join(projectDir, 'icon.ico')
  if (!fs.existsSync(iconPath)) {
    console.warn('[after-pack] No se encontró icon.ico en la raíz del proyecto.')
    return
  }

  const name = context.packager.appInfo.productFilename
  const exePath = path.join(context.appOutDir, `${name}.exe`)
  if (!fs.existsSync(exePath)) {
    console.warn('[after-pack] No se encontró ejecutable:', exePath)
    return
  }

  await rcedit(exePath, { icon: iconPath })
  console.log('[after-pack] Icono aplicado con éxito a', path.basename(exePath))
}
