/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Config
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getConfig: () => ipcRenderer.invoke('get-config'),

  // Database
  testConnection: (config) => ipcRenderer.invoke('test-connection', config),
  createDatabase: (config) => ipcRenderer.invoke('create-database', config),
  runMigrations: () => ipcRenderer.invoke('run-migrations'),

  // App
  restart: () => ipcRenderer.invoke('restart-app'),

  // Actualizaciones automáticas (100% internas, sin popups nativos)
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  installUpdate: () => ipcRenderer.send('install-update'),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  onUpdateAvailable: (callback) => {
    const handler = (_e, info) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onDownloadProgress: (callback) => {
    const handler = (_e, progress) => callback(progress);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_e, info) => callback(info);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  onUpdateError: (callback) => {
    const handler = (_e, error) => callback(error);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },

  // Impresoras del Sistema e Impresión Silenciosa
  getPrinters: () => ipcRenderer.invoke('printers:list'),
  getPrinterConfig: () => ipcRenderer.invoke('printers:get-config'),
  savePrinterConfig: (config) => ipcRenderer.invoke('printers:save-config', config),
  printSilent: (opts) => ipcRenderer.invoke('printers:print-html', opts),
  printCurrentWindow: (opts) => ipcRenderer.invoke('printers:print-current-window', opts),

  // Exportar a PDF
  exportToPdf: (opts) => ipcRenderer.invoke('printers:export-pdf', opts),
});

// Interceptar window.print para impresión silenciosa si está configurada
if (typeof window !== 'undefined') {
  const originalWindowPrint = window.print;
  window.print = async function () {
    try {
      const config = await ipcRenderer.invoke('printers:get-config');
      const url = (window.location.href || '').toLowerCase();
      const isA4 =
        url.includes('template=a4') ||
        Boolean(document.querySelector('[data-print-format="a4"]')) ||
        Boolean(document.querySelector('.print-container-wrapper'));
      const isTicket = !isA4;

      const targetPrinter = isTicket ? config?.thermalPrinter : config?.a4Printer;
      if (targetPrinter && typeof targetPrinter === 'string' && targetPrinter.trim() !== '') {
        const res = await ipcRenderer.invoke('printers:print-current-window', {
          deviceName: targetPrinter.trim(),
          format: isTicket ? 'ticket' : 'a4',
        });
        if (res && res.success) {
          return;
        }
      }
    } catch (err) {
      console.warn('[Print Hook] Error en impresión silenciosa:', err);
    }
    // Fallback al diálogo normal si no hay impresora configurada o falló
    originalWindowPrint.call(window);
  };
}
