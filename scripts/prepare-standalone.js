const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');
const staticSrc = path.join(rootDir, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
const publicSrc = path.join(rootDir, 'public');
const publicDest = path.join(standaloneDir, 'public');

if (!fs.existsSync(standaloneDir)) {
  console.error('[prepare-standalone] Error: .next/standalone no existe. Corre "next build" primero.');
  process.exit(1);
}

// 1. Copiar .next/static -> .next/standalone/.next/static
if (fs.existsSync(staticSrc)) {
  fs.mkdirSync(path.dirname(staticDest), { recursive: true });
  fs.cpSync(staticSrc, staticDest, { recursive: true });
  console.log('[prepare-standalone] .next/static copiado a .next/standalone/.next/static');
} else {
  console.warn('[prepare-standalone] Advertencia: No se encontró .next/static');
}

// 2. Copiar public -> .next/standalone/public
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, publicDest, { recursive: true });
  console.log('[prepare-standalone] public copiado a .next/standalone/public');
}

// 3. Copiar archivo de variables de entorno para que el servidor standalone las cargue en producción
const envLocal = path.join(rootDir, '.env.local');
const envProd = path.join(rootDir, '.env.production');
const envDefault = path.join(rootDir, '.env');
const envDest = path.join(standaloneDir, '.env.production');

if (fs.existsSync(envLocal)) {
  fs.copyFileSync(envLocal, envDest);
  console.log('[prepare-standalone] .env.local copiado como .env.production en standalone');
} else if (fs.existsSync(envProd)) {
  fs.copyFileSync(envProd, envDest);
  console.log('[prepare-standalone] .env.production copiado en standalone');
} else if (fs.existsSync(envDefault)) {
  fs.copyFileSync(envDefault, envDest);
  console.log('[prepare-standalone] .env copiado como .env.production en standalone');
}

console.log('[prepare-standalone] Preparación de standalone completada con éxito.');
