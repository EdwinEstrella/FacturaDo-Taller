"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Printer } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { updateCompanySettings, type CompanySettings } from "@/actions/settings-actions"
import { toast } from "sonner"
import { InvoiceOdooTemplate } from "@/components/modules/invoices/invoice-odoo-template"

export function SettingsGeneralClient({ initialSettings }: { initialSettings: CompanySettings }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<CompanySettings>(initialSettings)
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false)

    // Estado para impresoras de escritorio
    const [printers, setPrinters] = useState<Array<{ name: string; displayName: string; isDefault: boolean }>>([])
    const [printerConfig, setPrinterConfig] = useState<{ thermalPrinter: string; a4Printer: string }>({
        thermalPrinter: "",
        a4Printer: "",
    })
    const [savingPrinters, setSavingPrinters] = useState(false)
    const [isDesktop, setIsDesktop] = useState(false)

    useEffect(() => {
        if (typeof window !== "undefined" && window.electron?.getPrinters) {
            setIsDesktop(true)
            window.electron.getPrinters().then((list) => {
                if (list) setPrinters(list)
            })
            window.electron.getPrinterConfig?.().then((cfg) => {
                if (cfg) {
                    setPrinterConfig({
                        thermalPrinter: cfg.thermalPrinter || "",
                        a4Printer: cfg.a4Printer || "",
                    })
                }
            })
        }
    }, [])

    const handleSavePrinters = async () => {
        if (!window.electron?.savePrinterConfig) return
        setSavingPrinters(true)
        try {
            await window.electron.savePrinterConfig(printerConfig)
            toast.success("Configuración de impresoras guardada correctamente")
        } catch {
            toast.error("Error al guardar la configuración de impresoras")
        } finally {
            setSavingPrinters(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const res = await updateCompanySettings(formData)
        setLoading(false)

        if (res.success) {
            toast.success("Configuración actualizada correctamente")
            router.refresh()
        } else {
            toast.error(res.error || "Error al actualizar la configuración")
        }
    }

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = () => {
            const result = reader.result as string
            setFormData(prev => ({ ...prev, companyLogo: result }))
        }
        reader.readAsDataURL(file)
    }

    const setTemplate = (template: "ticket" | "a4") => {
        setFormData(prev => ({ ...prev, invoiceTemplate: template }))
    }

    const handleChooseA4Template = () => {
        setTemplate("a4")
        setTemplateDialogOpen(false)
        toast.success("Plantilla A4 seleccionada")
    }

    // Datos de ejemplo para previsualización A4 (no se guardan ni afectan facturas reales)
    const exampleInvoice = {
        id: "preview",
        sequenceNumber: 1234,
        ncf: "B0100000001",
        ncfType: "CONSUMO",
        clientName: "Cliente de Ejemplo",
        client: {
            id: "client-preview",
            name: "Cliente de Ejemplo",
            rnc: "101-0000000",
            address: "Av. Siempre Viva 123",
            phone: "809-555-0000",
            email: "cliente@example.com",
        },
        items: [
            { id: "item-1", productName: "Producto A", quantity: 2, price: 1500 },
            { id: "item-2", productName: "Servicio B", quantity: 1, price: 2500 },
        ],
        tax: 720, // ITBIS aproximado
        shippingCost: 0,
        total: 6200,
        status: "PAID",
        balance: 0,
        paymentMethod: "CASH",
        createdAt: new Date(),
        deliveryDate: null,
        notes: "Este es un ejemplo de factura A4.",
        createdBy: { name: "Usuario Demo" },
    }

    return (
        <div className="grid gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>Información del Negocio</CardTitle>
                    <CardDescription>
                        Estos datos aparecerán en las facturas y documentos oficiales.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="companyName">Nombre del Negocio</Label>
                            <Input
                                id="companyName"
                                name="companyName"
                                value={formData.companyName}
                                onChange={handleChange}
                                placeholder="Ej: FacturaDO"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="companyRnc">RNC / Cédula</Label>
                            <Input
                                id="companyRnc"
                                name="companyRnc"
                                value={formData.companyRnc}
                                onChange={handleChange}
                                placeholder="Ej: 101-00000-0"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="companyPhone">Teléfono</Label>
                            <Input
                                id="companyPhone"
                                name="companyPhone"
                                value={formData.companyPhone}
                                onChange={handleChange}
                                placeholder="Ej: 809-555-0000"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="companyAddress">Dirección</Label>
                            <Input
                                id="companyAddress"
                                name="companyAddress"
                                value={formData.companyAddress}
                                onChange={handleChange}
                                placeholder="Ej: Av. Winston Churchill #101"
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : "Guardar cambios y logo"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Diseño de Factura A4</CardTitle>
                    <CardDescription>
                        Elige el template de diseño de impresión A4 y el logo que se usará en las facturas.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold">Template de diseño de impresión A4</p>
                            <p className="text-xs text-gray-600">
                                Por ahora hay un solo diseño disponible. En futuras versiones podrás escoger entre varios templates.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setTemplateDialogOpen(true)}
                            className={formData.invoiceTemplate === "a4" ? "border-blue-500 bg-blue-50" : ""}
                        >
                            Ver plantillas disponibles
                        </Button>
                    </div>

                    <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                        <DialogContent className="max-w-[520px] max-h-[85vh] overflow-hidden">
                            <DialogHeader>
                                <DialogTitle>Plantillas disponibles</DialogTitle>
                                <DialogDescription>
                                    Haz click en una plantilla para seleccionarla como diseño de impresión A4.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="overflow-x-auto pb-2">
                                <div className="flex min-w-max gap-4">
                                    <button
                                        type="button"
                                        onClick={handleChooseA4Template}
                                        className={`w-[190px] shrink-0 rounded-xl border bg-white p-2 text-left shadow-sm transition hover:border-blue-500 hover:shadow-md ${formData.invoiceTemplate === "a4" ? "border-blue-600 ring-2 ring-blue-200" : "border-gray-200"}`}
                                    >
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold">Clásica azul A4</p>
                                                <p className="text-[11px] text-gray-500">Tabla azul corporativa.</p>
                                            </div>
                                            {formData.invoiceTemplate === "a4" && (
                                                <span className="shrink-0 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                                                    Activa
                                                </span>
                                            )}
                                        </div>

                                        {/* Preview: 810×1160 scaled 0.48 → visual ~389×557px, clipped at 320px height */}
                                        <div className="mx-auto overflow-hidden rounded-lg border bg-gray-50" style={{ width: "160px", height: "220px" }}>
                                            <div
                                                className="w-[810px] origin-top-left"
                                                style={{ transform: "scale(0.19)", transformOrigin: "top left" }}
                                            >
                                                <InvoiceOdooTemplate invoice={exampleInvoice} settings={formData} />
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <div className="grid md:grid-cols-[auto,1fr] gap-4 items-center">
                        <div className="w-24 h-24 border rounded flex items-center justify-center bg-white overflow-hidden">
                            {formData.companyLogo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={formData.companyLogo}
                                    alt="Logo actual"
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : (
                                <span className="text-xs text-gray-400 text-center px-2">Sin logo</span>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="companyLogo">Logo de la empresa</Label>
                            <Input
                                id="companyLogo"
                                type="file"
                                accept="image/*"
                                onChange={handleLogoChange}
                            />
                            <p className="text-xs text-gray-500">
                                Se recomienda un logo en PNG con fondo transparente. Se almacenará dentro de la aplicación.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Printer className="h-5 w-5 text-primary" />
                        <CardTitle>Impresoras del Sistema (Impresión Silenciosa)</CardTitle>
                    </div>
                    <CardDescription>
                        Configura la impresora térmica y la impresora A4. Solo si las seleccionas aquí, los documentos se imprimirán de forma silenciosa sin abrir el cuadro de diálogo de Windows. Si las dejas en &quot;Ninguna&quot;, se abrirá el diálogo habitual.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isDesktop ? (
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="thermalPrinter" className="font-semibold text-sm">
                                    Impresora Térmica (Tickets / Rollo 80mm)
                                </Label>
                                <select
                                    id="thermalPrinter"
                                    value={printerConfig.thermalPrinter}
                                    onChange={(e) => setPrinterConfig(prev => ({ ...prev, thermalPrinter: e.target.value }))}
                                    className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <option value="">Ninguna (Abrir cuadro de diálogo de Windows)</option>
                                    {printers.map((p) => (
                                        <option key={p.name} value={p.name}>
                                            {p.displayName || p.name} {p.isDefault ? "(Predeterminada)" : ""}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    Aplica a tickets de venta, cuadres de caja y recibos de caja chica.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="a4Printer" className="font-semibold text-sm">
                                    Impresora A4 (Documentos / Cotizaciones / Facturas A4)
                                </Label>
                                <select
                                    id="a4Printer"
                                    value={printerConfig.a4Printer}
                                    onChange={(e) => setPrinterConfig(prev => ({ ...prev, a4Printer: e.target.value }))}
                                    className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <option value="">Ninguna (Abrir cuadro de diálogo de Windows)</option>
                                    {printers.map((p) => (
                                        <option key={p.name} value={p.name}>
                                            {p.displayName || p.name} {p.isDefault ? "(Predeterminada)" : ""}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    Aplica a facturas A4 completas, reportes y cotizaciones.
                                </p>
                            </div>

                            <div className="md:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t">
                                <div className="text-xs text-muted-foreground">
                                    {printerConfig.thermalPrinter || printerConfig.a4Printer ? (
                                        <span className="text-emerald-600 font-medium">
                                            ✓ Impresión silenciosa activa para las impresoras seleccionadas
                                        </span>
                                    ) : (
                                        <span>Modo interactivo: se abrirá el diálogo habitual de impresión</span>
                                    )}
                                </div>
                                <Button onClick={handleSavePrinters} disabled={savingPrinters}>
                                    {savingPrinters ? "Guardando..." : "Guardar impresoras"}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground bg-muted/40 p-4 rounded-lg border">
                            La configuración de impresión silenciosa y selección de dispositivos de hardware está disponible cuando ejecutas FacturaDo en su aplicación de escritorio.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
