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
});
