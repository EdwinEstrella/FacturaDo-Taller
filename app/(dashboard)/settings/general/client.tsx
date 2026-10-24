"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Image as ImageIcon, Loader2, Printer, Upload } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SettingsSection } from "@/components/modules/settings/settings-nav"
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
    const logoInputRef = useRef<HTMLInputElement>(null)

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

    const NONE = "__none__"
    const printerOptions = printers.map((p) => ({
        value: p.name,
        label: `${p.displayName || p.name}${p.isDefault ? " (predeterminada)" : ""}`,
    }))

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <SettingsSection
                title="Datos de la empresa"
                description="Aparecen en el encabezado de facturas, cotizaciones y reportes."
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nombre del negocio" htmlFor="companyName" className="sm:col-span-2">
                        <Input id="companyName" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="Ej: Aluminios del Este SRL" />
                    </Field>
                    <Field label="RNC / Cédula" htmlFor="companyRnc">
                        <Input id="companyRnc" name="companyRnc" value={formData.companyRnc} onChange={handleChange} placeholder="101-00000-0" />
                    </Field>
                    <Field label="Teléfono" htmlFor="companyPhone">
                        <Input id="companyPhone" name="companyPhone" value={formData.companyPhone} onChange={handleChange} placeholder="809-555-0000" />
                    </Field>
                    <Field label="Dirección" htmlFor="companyAddress" className="sm:col-span-2">
                        <Input id="companyAddress" name="companyAddress" value={formData.companyAddress} onChange={handleChange} placeholder="Av. Winston Churchill #101, Santo Domingo" />
                    </Field>
                </div>
            </SettingsSection>

            <SettingsSection
                title="Logo"
                description="Se imprime en las facturas. Usá un PNG con fondo transparente para mejor resultado."
            >
                <div className="flex flex-wrap items-center gap-5">
                    <div className="flex size-24 items-center justify-center overflow-hidden rounded-xl border bg-slate-50">
                        {formData.companyLogo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={formData.companyLogo} alt="Logo actual" className="max-h-full max-w-full object-contain p-2" />
                        ) : (
                            <ImageIcon className="size-7 text-slate-300" />
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>
                            <Upload className="mr-2 h-4 w-4" />
                            {formData.companyLogo ? "Cambiar logo" : "Subir logo"}
                        </Button>
                        {formData.companyLogo && (
                            <Button type="button" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setFormData((prev) => ({ ...prev, companyLogo: "" }))}>
                                Quitar
                            </Button>
                        )}
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                    </div>
                </div>
            </SettingsSection>

            <SettingsSection
                title="Diseño de factura A4"
                description="Plantilla que se usa al imprimir facturas en hoja completa."
            >
                <button
                    type="button"
                    onClick={() => setTemplateDialogOpen(true)}
                    className="flex w-full items-center gap-4 rounded-xl border p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
                >
                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md border bg-white">
                        <div className="w-[810px] origin-top-left" style={{ transform: "scale(0.069)" }}>
                            <InvoiceOdooTemplate invoice={exampleInvoice} settings={formData} />
                        </div>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-medium">Clásica azul</p>
                        <p className="text-sm text-muted-foreground">Tabla azul corporativa con logo y datos fiscales.</p>
                    </div>
                    {formData.invoiceTemplate === "a4" ? (
                        <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">Activa</span>
                    ) : (
                        <span className="text-sm font-medium text-blue-700">Ver</span>
                    )}
                </button>

                <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                    <DialogContent className="max-w-[520px]">
                        <DialogHeader>
                            <DialogTitle>Plantillas disponibles</DialogTitle>
                            <DialogDescription>Elegí la plantilla para imprimir facturas A4.</DialogDescription>
                        </DialogHeader>
                        <button
                            type="button"
                            onClick={handleChooseA4Template}
                            className={`w-[200px] rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-blue-500 ${formData.invoiceTemplate === "a4" ? "border-blue-600 ring-2 ring-blue-200" : "border-slate-200"}`}
                        >
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold">Clásica azul</p>
                                {formData.invoiceTemplate === "a4" && (
                                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">Activa</span>
                                )}
                            </div>
                            <div className="mx-auto overflow-hidden rounded-lg border bg-slate-50" style={{ width: "160px", height: "220px" }}>
                                <div className="w-[810px] origin-top-left" style={{ transform: "scale(0.19)" }}>
                                    <InvoiceOdooTemplate invoice={exampleInvoice} settings={formData} />
                                </div>
                            </div>
                        </button>
                    </DialogContent>
                </Dialog>
            </SettingsSection>

            <div className="flex justify-end">
                <Button type="submit" disabled={loading} className="min-w-40">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar cambios
                </Button>
            </div>

            <SettingsSection
                title="Impresoras"
                description="Si elegís una impresora, los documentos se imprimen directo sin abrir el cuadro de Windows."
                footer={isDesktop ? (
                    <>
                        <span className="mr-auto text-sm text-muted-foreground">
                            {printerConfig.thermalPrinter || printerConfig.a4Printer ? "Impresión directa activa" : "Se abrirá el cuadro de impresión"}
                        </span>
                        <Button type="button" variant="outline" onClick={handleSavePrinters} disabled={savingPrinters}>
                            {savingPrinters && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar impresoras
                        </Button>
                    </>
                ) : undefined}
            >
                {isDesktop ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Térmica (tickets 80 mm)" hint="Tickets de venta, cuadres de caja y recibos.">
                            <Select
                                value={printerConfig.thermalPrinter || NONE}
                                onValueChange={(v) => setPrinterConfig((prev) => ({ ...prev, thermalPrinter: v === NONE ? "" : v }))}
                            >
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>Preguntar al imprimir</SelectItem>
                                    {printerOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Hoja completa (A4 / Carta)" hint="Facturas A4, cotizaciones y reportes.">
                            <Select
                                value={printerConfig.a4Printer || NONE}
                                onValueChange={(v) => setPrinterConfig((prev) => ({ ...prev, a4Printer: v === NONE ? "" : v }))}
                            >
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>Preguntar al imprimir</SelectItem>
                                    {printerOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>
                ) : (
                    <div className="flex items-start gap-3 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">
                        <Printer className="mt-0.5 size-4 shrink-0" />
                        Disponible en la aplicación de escritorio de FacturaDo.
                    </div>
                )}
            </SettingsSection>
        </form>
    )
}

function Field({ label, htmlFor, hint, className = "", children }: {
    label: string
    htmlFor?: string
    hint?: string
    className?: string
    children: React.ReactNode
}) {
    return (
        <div className={`space-y-2 ${className}`}>
            <Label htmlFor={htmlFor} className="text-sm font-medium">{label}</Label>
            {children}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    )
}
