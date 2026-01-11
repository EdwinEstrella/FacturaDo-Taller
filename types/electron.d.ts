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
}

declare global {
    interface Window {
        electron?: ElectronAPI;
    }
}
