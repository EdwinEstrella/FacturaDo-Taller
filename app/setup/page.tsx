"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, CheckCircle, Database } from "lucide-react";

export default function SetupPage() {
    const [isElectron, setIsElectron] = useState(false);
    const [mode, setMode] = useState<"new" | "existing">("new");
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);

    const [formData, setFormData] = useState({
        companyName: "",
        host: "localhost",
        port: "5432",
        user: "postgres",
        password: "",
        database: "facturado_prod",
    });

    useEffect(() => {
        if (typeof window !== "undefined" && window.electron) {
            setIsElectron(true);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const testConnection = async () => {
        if (!window.electron) return;
        setTesting(true);
        try {
            const res = await window.electron.testConnection(formData);
            if (res.success) {
                toast.success("Conexión exitosa", { description: res.message });
            } else {
                toast.error("Error de conexión", { description: res.message });
            }
        } catch {
            toast.error("Error desconocido probar conexión");
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        if (!window.electron) return;

        if (!formData.companyName && mode === 'new') {
            toast.error("Por favor ingrese el nombre de la empresa");
            return;
        }

        setLoading(true);
        try {
            // 1. If new, create database
            if (mode === "new") {
                toast.info("Creando base de datos...");
                const createRes = await window.electron.createDatabase(formData);
                if (!createRes.success) {
                    throw new Error(createRes.message || "Error creando base de datos");
                }
                toast.success("Base de datos creada");
            }

            // 2. Run migrations (for both new and existing, to ensure schema is up to date)
            toast.info("Ejecutando migraciones...");
            const migrateRes = await window.electron.runMigrations();
            if (!migrateRes.success) {
                // If we fail here, we might still want to ask user if they want to save?
                // But strict consistency is better.
                throw new Error(migrateRes.error || "Error en migraciones");
            }
            toast.success("Migraciones completadas");

            // 3. Save config
            await window.electron.saveConfig(formData);
            toast.success("Configuración guardada");

            // 4. Restart
            toast.message("Reiniciando aplicación en 3 segundos...", {
                duration: 3000,
            });
            setTimeout(() => {
                window.electron?.restart();
            }, 3000);

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            toast.error("Error en el proceso de configuración", { description: msg });
        } finally {
            setLoading(false);
        }
    };

    if (!isElectron) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Modo Web</CardTitle>
                        <CardDescription>
                            Esta página de configuración es solo para la versión de escritorio (Electron).
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
            <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-blue-600">
                <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Configuración Inicial</CardTitle>
                            <CardDescription>Conecta tu base de datos para comenzar</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">

                    <RadioGroup defaultValue="new" onValueChange={(v) => setMode(v as "new" | "existing")} className="grid grid-cols-2 gap-4">
                        <div>
                            <RadioGroupItem value="new" id="new" className="peer sr-only" />
                            <Label
                                htmlFor="new"
                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-blue-600 [&:has([data-state=checked])]:border-primary cursor-pointer"
                            >
                                <span className="text-sm font-semibold">Nueva Instalación</span>
                                <span className="text-xs text-muted-foreground mt-1">Crear base de datos desde cero</span>
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="existing" id="existing" className="peer sr-only" />
                            <Label
                                htmlFor="existing"
                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-blue-600 [&:has([data-state=checked])]:border-primary cursor-pointer"
                            >
                                <span className="text-sm font-semibold">Base Existente</span>
                                <span className="text-xs text-muted-foreground mt-1">Conectar a datos ya creados</span>
                            </Label>
                        </div>
                    </RadioGroup>

                    <div className="space-y-4">
                        {mode === 'new' && (
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Nombre de Empresa</Label>
                                <Input id="companyName" name="companyName" placeholder="Ej. Mi Empresa S.A." value={formData.companyName} onChange={handleChange} />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="host">Servidor (Host)</Label>
                                <Input id="host" name="host" value={formData.host} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="port">Puerto</Label>
                                <Input id="port" name="port" value={formData.port} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="user">Usuario BD</Label>
                                <Input id="user" name="user" value={formData.user} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña</Label>
                                <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="database">Nombre de Base de Datos</Label>
                            <Input id="database" name="database" value={formData.database} onChange={handleChange} />
                        </div>
                    </div>

                </CardContent>
                <CardFooter className="flex justify-between bg-gray-50/50 dark:bg-gray-900/50 p-6">
                    <Button variant="outline" onClick={testConnection} disabled={loading || testing}>
                        {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Probar Conexión
                    </Button>
                    <Button onClick={handleSave} disabled={loading || testing} className="bg-blue-600 hover:bg-blue-700">
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        {mode === 'new' ? 'Instalar y Continuar' : 'Guardar y Continuar'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
