"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updateCompanySettings, type CompanySettings } from "@/actions/settings-actions"
import { toast } from "sonner"

export function SettingsGeneralClient({ initialSettings }: { initialSettings: CompanySettings }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<CompanySettings>(initialSettings)

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
                                {loading ? "Guardando..." : "Guardar Cambios"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
