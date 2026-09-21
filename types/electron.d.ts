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
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
