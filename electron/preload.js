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
});
