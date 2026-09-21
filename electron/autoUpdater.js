/* eslint-disable @typescript-eslint/no-require-imports */
const { BrowserWindow, ipcMain } = require('electron');
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
};

function getTargetWindow(getMainWindow) {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  const main = getMainWindow ? getMainWindow() : null;
  if (main && !main.isDestroyed()) return main;
  const all = BrowserWindow.getAllWindows();
  return all.find((w) => !w.isDestroyed()) ?? null;
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
    const win = getTargetWindow(getMainWindow);
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
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

    ipcMain.on('check-for-updates', () => {
      updateState.phase = 'checking';
      updateState.percent = 0;
      updateState.error = '';
      send('checking-for-update');
      autoUpdater.checkForUpdates().catch((err) => {
        log.warn('checkForUpdates failed', err);
        updateState.phase = 'error';
        updateState.error = err.message || String(err);
        send('update-error', updateState.error);
      });
    });

    ipcMain.handle('get-update-state', () => ({ ...updateState }));
  }

  // Comprobar automáticamente después de 4 segundos del arranque
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.warn('autoUpdater initial check failed', err);
    });
  }, 4000);
}

module.exports = { setupAutoUpdater };
