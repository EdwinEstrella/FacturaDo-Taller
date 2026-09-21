/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const { spawn, execSync } = require('child_process');
const { createDatabase, testConnection, runMigrations } = require('./db-manager');

// 1. Bloqueo de instancia única (igual que Cyberbistro)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Almacén de configuración ligero sin dependencias ESM
function getStoreConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error('[Config] Error leyendo config:', e);
  }
  return {};
}

function setStoreConfig(data) {
  try {
    const configDir = app.getPath('userData');
    fs.mkdirSync(configDir, { recursive: true });
    const configPath = path.join(configDir, 'config.json');
    const existing = getStoreConfig();
    const updated = { ...existing, ...data };
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
  } catch (e) {
    console.error('[Config] Error guardando config:', e);
  }
}

let mainWindow = null;
let nextServerProcess = null;
let activeServerUrl = null;

const isDev = !app.isPackaged;
if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

// Identidad de la barra de tareas en Windows
app.setAppUserModelId('com.facturado.app');

/**
 * Encuentra un puerto TCP disponible en 127.0.0.1
 */
function findAvailablePort(preferredPort = 3000) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();

    server.once('error', () => {
      // Puerto preferido ocupado, obtener un puerto aleatorio libre
      const randomServer = net.createServer();
      randomServer.unref();
      randomServer.once('listening', () => {
        const port = randomServer.address().port;
        randomServer.close(() => resolve(port));
      });
      randomServer.listen(0, '127.0.0.1');
    });

    server.once('listening', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });

    server.listen(preferredPort, '127.0.0.1');
  });
}

/**
 * Espera hasta que el servidor HTTP responda
 */
function waitForServer(url, timeoutMs = 45000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });

      req.on('error', () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Tiempo de espera agotado conectando con ${url}`));
        } else {
          setTimeout(check, 300);
        }
      });
    };
    check();
  });
}

/**
 * Inicia el servidor standalone empaquetado o se conecta al entorno dev
 */
async function startNextServer() {
  if (isDev) {
    console.log('[Electron] Modo desarrollo: conectando con Next.js en http://127.0.0.1:3000...');
    await waitForServer('http://127.0.0.1:3000', 60000);
    activeServerUrl = 'http://127.0.0.1:3000';
    console.log(`[Electron] Conectado exitosamente a ${activeServerUrl}`);
    return activeServerUrl;
  }

  // Rutas del servidor standalone
  let serverDir;
  let serverPath;

  if (app.isPackaged) {
    serverDir = path.join(process.resourcesPath, 'server');
    serverPath = path.join(serverDir, 'server.js');
  } else {
    serverDir = path.resolve(__dirname, '..', '.next', 'standalone');
    serverPath = path.join(serverDir, 'server.js');
  }

  if (!fs.existsSync(serverPath)) {
    throw new Error(`No se encontró el servidor Next.js standalone en: ${serverPath}`);
  }

  const port = await findAvailablePort(3000);
  activeServerUrl = `http://127.0.0.1:${port}`;
  console.log(`[Electron] Iniciando servidor Next.js standalone en ${activeServerUrl}`);

  // Iniciar el servidor Next.js con el binario de Node embebido en Electron
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: port.toString(),
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
  };

  nextServerProcess = spawn(process.execPath, [serverPath], {
    cwd: serverDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  nextServerProcess.stdout.on('data', (data) => {
    console.log(`[Next.js]: ${data.toString().trim()}`);
  });

  nextServerProcess.stderr.on('data', (data) => {
    console.error(`[Next.js Error]: ${data.toString().trim()}`);
  });

  nextServerProcess.on('exit', (code, signal) => {
    console.log(`[Next.js] Servidor terminado (code: ${code}, signal: ${signal})`);
    nextServerProcess = null;
  });

  // Esperar a que el servidor esté listo
  await waitForServer(activeServerUrl);
  return activeServerUrl;
}

/**
 * Resuelve la ruta del icono de la aplicación
 */
function resolveIconPath() {
  const candidates = [
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(__dirname, '../icon.ico'),
    path.join(__dirname, 'icon.ico'),
    path.join(process.cwd(), 'icon.ico'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }
  return null;
}

/**
 * Termina limpiamente el proceso del servidor Next.js
 */
function killServer() {
  if (!nextServerProcess) return;
  try {
    if (process.platform === 'win32' && nextServerProcess.pid) {
      execSync(`taskkill /pid ${nextServerProcess.pid} /T /F`, { stdio: 'ignore' });
    } else {
      nextServerProcess.kill('SIGTERM');
    }
  } catch {}
  nextServerProcess = null;
}

function createWindow(baseUrl) {
  const iconPath = resolveIconPath();
  const iconImage = iconPath ? nativeImage.createFromPath(iconPath) : null;

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'FacturaDo',
    autoHideMenuBar: true,
    ...(iconImage ? { icon: iconImage } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // Abrir enlaces externos en el navegador predeterminado del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (activeServerUrl && url.startsWith(activeServerUrl)) {
        return { action: 'allow' };
      }
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.maximize();
    mainWindow.show();
  });

  const targetUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  console.log(`[Electron] Cargando aplicación en: ${targetUrl}`);
  mainWindow.loadURL(targetUrl);
}

// Control de segunda instancia: enfocar ventana existente
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Ciclo de vida de la aplicación
app.on('ready', async () => {
  try {
    const url = await startNextServer();
    createWindow(url);
  } catch (error) {
    console.error('[Electron] Error al inicializar el servidor:', error);
    app.quit();
  }
});

app.on('before-quit', () => {
  killServer();
});

app.on('will-quit', () => {
  killServer();
});

app.on('window-all-closed', () => {
  killServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && activeServerUrl) {
    createWindow(activeServerUrl);
  }
});

// IPC Handlers para compatibilidad existente
ipcMain.handle('get-config', () => {
  const cfg = getStoreConfig();
  return cfg.dbConfig || null;
});

ipcMain.handle('save-config', async (event, config) => {
  setStoreConfig({ dbConfig: config });
  return { success: true };
});

ipcMain.handle('test-connection', async (event, config) => {
  return await testConnection(config);
});

ipcMain.handle('create-database', async (event, config) => {
  return await createDatabase(config);
});

ipcMain.handle('run-migrations', async (event) => {
  const cfg = getStoreConfig();
  const config = cfg.dbConfig;
  if (!config) throw new Error('No configuration found');

  const dbUrl = `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}?schema=public`;
  try {
    const result = await runMigrations(dbUrl);
    return { success: true, log: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.exit();
});
