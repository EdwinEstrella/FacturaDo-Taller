/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

let listenersAttached = false;
let installPending = false;
let installStarted = false;

const updateState = {
  phase: 'idle', // 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  remoteVersion: null,
  downloadedVersion: null,
  percent: 0,
  error: '',
  lastCheckedAt: null,
};

// Cada cuánto se vuelve a buscar una versión nueva mientras la app está abierta.
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

function getTargetWindows(getMainWindow) {
  const main = getMainWindow ? getMainWindow() : null;
  const all = BrowserWindow.getAllWindows();
  // Las ventanas ocultas de impresión/PDF no muestran la barra superior: solo las visibles y la principal.
  const targets = all.filter((w) => !w.isDestroyed() && !w.webContents?.isDestroyed() && (w === main || w.isVisible()));
  return targets;
}

function installDownloadedUpdate() {
  if (installStarted) return;
  if (updateState.phase !== 'ready') {
    installPending = true;
    return;
  }

  installPending = false;
  installStarted = true;

  setTimeout(() => {
    try {
      // isSilent: true -> instalación silenciosa sin asistente de Windows que robe el foco
      // isForceRunAfter: true -> la aplicación se abre sola automáticamente tras actualizar
      autoUpdater.quitAndInstall(true, true);
    } catch (err) {
      installStarted = false;
      updateState.phase = 'error';
      updateState.error = err instanceof Error ? err.message : String(err);
      log.error('quitAndInstall failed', err);
    }
  }, 250);
}

function setupAutoUpdater(getMainWindow) {
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  autoUpdater.autoDownload = true;

  if (process.platform === 'win32' && !process.env.CSC_LINK && !process.env.WIN_CSC_LINK) {
    autoUpdater.verifyUpdateCodeSignature = false;
  }

  const send = (channel, payload) => {
    for (const win of getTargetWindows(getMainWindow)) {
      try {
        win.webContents.send(channel, payload);
      } catch (err) {
        log.warn(`[AutoUpdater] Error enviando evento ${channel}:`, err);
      }
    }
  };

  const check = (reason) => {
    // Ya descargada o descargando: no hace falta volver a buscar.
    if (updateState.phase === 'ready' || updateState.phase === 'downloading' || installStarted) return;
    updateState.phase = 'checking';
    updateState.percent = 0;
    updateState.error = '';
    send('checking-for-update');
    autoUpdater.checkForUpdates().catch((err) => {
      log.warn(`checkForUpdates failed (${reason})`, err);
      updateState.phase = 'error';
      updateState.error = err.message || String(err);
      send('update-error', updateState.error);
    });
  };

  if (!listenersAttached) {
    listenersAttached = true;

    autoUpdater.on('update-available', (info) => {
      updateState.phase = 'available';
      updateState.remoteVersion = info.version || null;
      updateState.downloadedVersion = null;
      updateState.percent = 0;
      updateState.error = '';
      send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    });

    autoUpdater.on('update-not-available', () => {
      if (updateState.phase !== 'ready') {
        updateState.phase = 'idle';
        updateState.percent = 0;
      }
      updateState.lastCheckedAt = new Date().toISOString();
      send('update-not-available');
    });

    autoUpdater.on('download-progress', (progress) => {
      updateState.phase = 'downloading';
      updateState.percent = Math.round(progress.percent);
      updateState.error = '';
      send('download-progress', {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      updateState.phase = 'ready';
      updateState.downloadedVersion = info.version || null;
      updateState.percent = 100;
      updateState.error = '';
      send('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
      if (installPending) installDownloadedUpdate();
    });

    autoUpdater.on('error', (err) => {
      log.error('autoUpdater error', err);
      if (updateState.phase !== 'ready') {
        updateState.phase = 'error';
        updateState.error = err.message || String(err);
      }
      send('update-error', updateState.error);
    });

    ipcMain.on('install-update', () => {
      installDownloadedUpdate();
    });

    ipcMain.on('check-for-updates', () => check('manual'));

    ipcMain.handle('get-update-state', () => ({ ...updateState, currentVersion: app.getVersion() }));

    // Comprobar después del arranque y luego periódicamente: antes solo se buscaba una vez al abrir,
    // así que una versión publicada con el sistema abierto nunca aparecía.
    setTimeout(() => check('startup'), 4000);
    setInterval(() => check('interval'), CHECK_INTERVAL_MS);
  }
}

module.exports = { setupAutoUpdater };
