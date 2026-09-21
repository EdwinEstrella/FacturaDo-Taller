/**
 * Genera icon.ico multi-resolución desde app/icon.png (requisito habitual en Windows / electron-builder).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const pngSrc = path.join(root, 'app', 'icon.png')
const outIco = path.join(root, 'icon.ico')

// Tamaños estándar Windows ICO
const sizes = [16, 24, 32, 48, 64, 128, 256]

/**
 * ICO con entradas PNG (Windows Vista+).
 * @param {Array<{ w: number; h: number; png: Buffer }>} entries
 */
function icoFromPngEntries(entries) {
  const n = entries.length
  const headerSize = 6 + 16 * n
  let dataOffset = headerSize
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(n, 4)
  for (let i = 0; i < n; i++) {
    const { w, h, png } = entries[i]
    const dir = 6 + i * 16
    header.writeUInt8(w >= 256 ? 0 : w, dir)
    header.writeUInt8(h >= 256 ? 0 : h, dir + 1)
    header.writeUInt8(0, dir + 2)
    header.writeUInt8(0, dir + 3)
    header.writeUInt16LE(1, dir + 4)
    header.writeUInt16LE(32, dir + 6)
    header.writeUInt32LE(png.length, dir + 8)
    header.writeUInt32LE(dataOffset, dir + 12)
    dataOffset += png.length
  }
  return Buffer.concat([header, ...entries.map((e) => e.png)])
}

async function main() {
  if (!fs.existsSync(pngSrc)) {
    console.error(`No existe el archivo de origen: ${pngSrc}`)
    process.exit(1)
  }

  const entries = await Promise.all(
    sizes.map(async (s) => ({
      w: s,
      h: s,
      png: await sharp(pngSrc).resize(s, s).png().toBuffer(),
    }))
  )

  const ico = icoFromPngEntries(entries)
  fs.writeFileSync(outIco, ico)
  console.log(`icon.ico generado (${sizes.length} resoluciones): ${outIco}`)

  // Copia a public/favicon.ico
  const publicDir = path.join(root, 'public')
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true })
  const faviconPath = path.join(publicDir, 'favicon.ico')
  fs.copyFileSync(outIco, faviconPath)
  console.log(`public/favicon.ico sincronizado`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
