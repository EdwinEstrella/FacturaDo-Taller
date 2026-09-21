/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const { spawn, execSync } = require('child_process');
const { createDatabase, testConnection, runMigrations } = require('./db-manager');
const { setupAutoUpdater } = require('./autoUpdater');

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
    setupAutoUpdater(() => mainWindow);
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

// IPC Handlers para impresoras (térmica y A4 silenciosa)
let hiddenPrintWin = null;

ipcMain.handle('printers:list', async () => {
  const win = mainWindow || BrowserWindow.getAllWindows()[0];
  if (!win) return [];
  try {
    const list = await win.webContents.getPrintersAsync();
    return list.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      description: p.description || '',
      isDefault: Boolean(p.isDefault),
    }));
  } catch (err) {
    console.error('[Printers] Error listando impresoras:', err);
    return [];
  }
});

ipcMain.handle('printers:get-config', () => {
  const cfg = getStoreConfig();
  return cfg.printers || { thermalPrinter: '', a4Printer: '' };
});

ipcMain.handle('printers:save-config', async (_event, printerConfig) => {
  setStoreConfig({ printers: printerConfig });
  return { success: true };
});

ipcMain.handle('printers:print-current-window', async (event, { deviceName, format }) => {
  const senderWc = event.sender;
  if (!senderWc || senderWc.isDestroyed()) return { success: false, error: 'Ventana destruida' };

  const isThermal = format === 'ticket';
  const printOptions = {
    silent: true,
    deviceName,
    printBackground: true,
    margins: { marginType: isThermal ? 'none' : 'default' },
    ...(isThermal ? { pageSize: { width: 80000, height: 297000 } } : { pageSize: 'A4' }),
  };

  return new Promise((resolve) => {
    try {
      senderWc.print(printOptions, (success, failureReason) => {
        resolve({ success, error: failureReason });
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle('printers:print-html', async (_event, { html, deviceName, format, css, headTags, baseUrl }) => {
  if (!hiddenPrintWin || hiddenPrintWin.isDestroyed()) {
    hiddenPrintWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
      },
    });
  }

  const isThermal = format === 'ticket';
  const baseHref = baseUrl ? `<base href="${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}">` : '';

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        ${baseHref}
        ${headTags || ''}
        <style>
          @page {
            margin: ${isThermal ? '0mm' : '8mm'};
            ${isThermal ? 'size: 80mm auto;' : 'size: A4 portrait;'}
          }
          *, *::before, *::after {
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
            color: #111827 !important;
          }
          ${isThermal ? `
          body {
            width: 80mm;
            padding: 2mm;
          }
          ` : `
          .print-container-wrapper {
            background: transparent !important;
            padding: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
            min-height: auto !important;
          }
          .invoice-page, .quote-page {
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }
          `}
          ${css || ''}
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `;

  await hiddenPrintWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

  await hiddenPrintWin.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const checkReady = () => {
        const images = Array.from(document.images);
        const allImagesLoaded = images.every(img => img.complete);
        const fontsReady = document.fonts ? document.fonts.status === 'loaded' : true;
        if (allImagesLoaded && fontsReady) {
          resolve(true);
        } else {
          setTimeout(checkReady, 50);
        }
      };
      if (document.readyState === 'complete') {
        checkReady();
      } else {
        window.addEventListener('load', checkReady);
      }
      setTimeout(() => resolve(true), 1500);
    })
  `);

  return new Promise((resolve) => {
    try {
      hiddenPrintWin.webContents.print(
        {
          silent: true,
          deviceName,
          printBackground: true,
          margins: { marginType: isThermal ? 'none' : 'default' },
          ...(isThermal ? { pageSize: { width: 80000, height: 297000 } } : { pageSize: 'A4' }),
        },
        (success, failureReason) => {
          resolve({ success, error: failureReason });
        }
      );
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle('printers:export-pdf', async (_event, { html, format, filename, css, headTags, baseUrl }) => {
  let pdfWin = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  const isThermal = format === 'ticket';
  const rawFilename = filename || (isThermal ? 'ticket.pdf' : 'documento.pdf');
  const sanitized = rawFilename.replace(/[/\\?%*:|"<>]/g, '-').trim();
  const cleanFilename = sanitized.toLowerCase().endsWith('.pdf') ? sanitized : `${sanitized}.pdf`;

  const downloadsDir = app.getPath('downloads');
  let finalPath = path.join(downloadsDir, cleanFilename);

  // Evitar sobreescribir archivos existentes
  const ext = path.extname(cleanFilename);
  const base = path.basename(cleanFilename, ext);
  let counter = 1;
  while (fs.existsSync(finalPath)) {
    finalPath = path.join(downloadsDir, `${base} (${counter})${ext}`);
    counter++;
  }

  const baseHref = baseUrl ? `<base href="${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}">` : '';

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        ${baseHref}
        ${headTags || ''}
        <style>
          @page {
            margin: ${isThermal ? '0mm' : '8mm'};
            ${isThermal ? 'size: 80mm auto;' : 'size: A4 portrait;'}
          }
          *, *::before, *::after {
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
            color: #111827 !important;
          }
          ${isThermal ? `
          body {
            width: 80mm;
            padding: 2mm;
          }
          ` : `
          .print-container-wrapper {
            background: transparent !important;
            padding: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
            min-height: auto !important;
          }
          .invoice-page, .quote-page {
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }
          `}
          ${css || ''}
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `;

  try {
    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

    // Wait for images and fonts to be ready
    await pdfWin.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const checkReady = () => {
          const images = Array.from(document.images);
          const allImagesLoaded = images.every(img => img.complete);
          const fontsReady = document.fonts ? document.fonts.status === 'loaded' : true;
          if (allImagesLoaded && fontsReady) {
            resolve(true);
          } else {
            setTimeout(checkReady, 50);
          }
        };
        if (document.readyState === 'complete') {
          checkReady();
        } else {
          window.addEventListener('load', checkReady);
        }
        setTimeout(() => resolve(true), 1500);
      })
    `);

    let pdfOptions;
    if (isThermal) {
      const heightInPixels = await pdfWin.webContents.executeJavaScript(`
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.offsetHeight
        )
      `).catch(() => 800);

      const heightMicrons = Math.ceil((heightInPixels * 25400) / 96) + 6000;

      pdfOptions = {
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        pageSize: {
          width: 80000,
          height: Math.max(heightMicrons, 80000),
        },
      };
    } else {
      pdfOptions = {
        printBackground: true,
        pageSize: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        preferCSSPageSize: true,
      };
    }

    const pdfBuffer = await pdfWin.webContents.printToPDF(pdfOptions);
    fs.writeFileSync(finalPath, pdfBuffer);

    if (pdfWin && !pdfWin.isDestroyed()) {
      pdfWin.destroy();
      pdfWin = null;
    }

    try {
      shell.showItemInFolder(finalPath);
    } catch {}

    return { success: true, filePath: finalPath, filename: path.basename(finalPath) };
  } catch (err) {
    if (pdfWin && !pdfWin.isDestroyed()) {
      pdfWin.destroy();
      pdfWin = null;
    }
    return { success: false, error: err.message || String(err) };
  }
});
