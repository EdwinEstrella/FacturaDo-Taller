/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | Array<{ version: string; note: string }>;
}

export interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
}

export interface PrinterConfig {
  thermalPrinter?: string;
  a4Printer?: string;
}

export interface ElectronAPI {
  // Config
  saveConfig: (config: any) => Promise<{ success: boolean }>;
  getConfig: () => Promise<any>;

  // Database
  testConnection: (config: any) => Promise<{ success: boolean; message?: string }>;
  createDatabase: (config: any) => Promise<{ success: boolean; message?: string }>;
  runMigrations: () => Promise<{ success: boolean; log?: string; error?: string }>;

  // App
  restart: () => void;

  // Actualizaciones automáticas (100% internas, sin popups del SO)
  checkForUpdates?: () => void;
  installUpdate?: () => void;
  getUpdateState?: () => Promise<{
    phase: string;
    remoteVersion: string | null;
    downloadedVersion: string | null;
    percent: number;
    error: string;
  }>;
  onUpdateAvailable?: (callback: (info: UpdateInfo) => void) => () => void;
  onDownloadProgress?: (callback: (progress: DownloadProgress) => void) => () => void;
  onUpdateDownloaded?: (callback: (info: UpdateInfo) => void) => () => void;
  onUpdateError?: (callback: (error: string) => void) => () => void;

  // Impresoras e Impresión Silenciosa
  getPrinters?: () => Promise<PrinterInfo[]>;
  getPrinterConfig?: () => Promise<PrinterConfig>;
  savePrinterConfig?: (config: PrinterConfig) => Promise<{ success: boolean }>;
  printSilent?: (opts: {
    html: string;
    deviceName: string;
    format?: 'ticket' | 'a4';
    css?: string;
    headTags?: string;
    baseUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  printCurrentWindow?: (opts: {
    deviceName: string;
    format?: 'ticket' | 'a4';
  }) => Promise<{ success: boolean; error?: string }>;
  exportToPdf?: (opts: {
    html: string;
    format?: 'ticket' | 'a4';
    filename?: string;
    css?: string;
    headTags?: string;
    baseUrl?: string;
  }) => Promise<{ success: boolean; filePath?: string; filename?: string; error?: string }>;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
