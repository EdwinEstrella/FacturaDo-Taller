/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { createDatabase, testConnection, runMigrations } = require('./db-manager');
const { spawn } = require('child_process');
const http = require('http');

const store = new Store();
let mainWindow;
let nextServerProcess;

const isDev = !app.isPackaged;
const NEXT_PORT = 3000;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        autoHideMenuBar: true, // Clean look for 1.0.0
    });

    const loadApp = () => {
        const config = store.get('dbConfig');
        const baseUrl = isDev ? `http://localhost:${NEXT_PORT}` : `http://localhost:${NEXT_PORT}`;
        const startUrl = config ? baseUrl : `${baseUrl}/setup`;

        console.log(`Loading URL: ${startUrl}`);

        mainWindow.loadURL(startUrl).catch(e => {
            console.log('Waiting for Next.js to start...');
            setTimeout(loadApp, 1000);
        });
    };

    loadApp();
}

// Start Next.js Server
function startNextServer() {
    if (isDev) {
        console.log('Dev mode: Expecting external Next.js server or concurrent run.');
        return;
    }

    // In production, we run the standalone build or start script
    // Ideally, we copy the .next/standalone folder to resources
    const serverPath = path.join(process.resourcesPath, 'server.js'); // Simplified for now

    // For this v1 implementation plan, we might rely on the user having node installed 
    // or bundle node. But usually 'next start' is what we want.
    // A robust way is spawning 'npm start' if dependencies are there, or 'node server.js' if standalone.

    console.log('Starting Next.js server...');
    const config = store.get('dbConfig');
    let env = { ...process.env, PORT: NEXT_PORT.toString() };

    if (config) {
        const dbUrl = `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}?schema=public`;
        env.DATABASE_URL = dbUrl;
        console.log('Injecting DATABASE_URL for Next.js');
    }

    nextServerProcess = spawn('npm', ['run', 'start'], {
        cwd: __dirname + '/../', // Adjust based on where main.js is relative to package.json in prod
        env: env,
        shell: true
    });

    nextServerProcess.stdout.on('data', (data) => {
        console.log(`Next.js: ${data}`);
    });

    nextServerProcess.stderr.on('data', (data) => {
        console.error(`Next.js Error: ${data}`);
    });
}

// IPC Handlers
ipcMain.handle('get-config', () => {
    return store.get('dbConfig') || null;
});

ipcMain.handle('save-config', async (event, config) => {
    store.set('dbConfig', config);
    return { success: true };
});

ipcMain.handle('test-connection', async (event, config) => {
    return await testConnection(config);
});

ipcMain.handle('create-database', async (event, config) => {
    return await createDatabase(config);
});

ipcMain.handle('run-migrations', async (event) => {
    const config = store.get('dbConfig');
    if (!config) throw new Error("No configuration found");

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

app.on('ready', () => {
    startNextServer();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
    if (nextServerProcess) {
        nextServerProcess.kill();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
