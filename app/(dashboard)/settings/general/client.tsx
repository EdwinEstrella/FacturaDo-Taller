"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updateCompanySettings, type CompanySettings } from "@/actions/settings-actions"
import { toast } from "sonner"
import { InvoiceOdooTemplate } from "@/components/modules/invoices/invoice-odoo-template"

export function SettingsGeneralClient({ initialSettings }: { initialSettings: CompanySettings }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<CompanySettings>(initialSettings)
    const [showA4Preview, setShowA4Preview] = useState(initialSettings.invoiceTemplate === "a4")

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
        setShowA4Preview(true)
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
                        <button
                            type="button"
                            onClick={handleChooseA4Template}
                            className={`border rounded-lg px-4 py-2 text-sm font-medium transition ${formData.invoiceTemplate === "a4" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
                        >
                            Elegir template de diseño de impresión A4
                        </button>
                    </div>

                    {showA4Preview && (
                        <div className="border rounded-lg p-4 bg-white">
                            <p className="text-sm font-semibold mb-2">Previsualización de factura A4</p>
                            <div className="border bg-gray-50 max-h-[540px] overflow-auto">
                                <InvoiceOdooTemplate invoice={exampleInvoice} settings={formData} />
                            </div>
                        </div>
                    )}

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
        </div>
    )
}
