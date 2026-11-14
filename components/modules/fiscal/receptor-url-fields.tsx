"use client"

import { Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { buildReceptorUrls } from "@/lib/fiscal/shared/receptor-urls"

const FIELDS = [
    { label: "URL de recepción", key: "reception" },
    { label: "URL de aprobación comercial", key: "approval" },
    { label: "URL de autenticación", key: "authentication" },
] as const

export function ReceptorUrlFields({ companyRnc }: { companyRnc: string }) {
    const urls = buildReceptorUrls(companyRnc)

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(urls.portalField)
            toast.success("Copiado")
        } catch {
            toast.error("No se pudo copiar. Selecciona el texto y cópialo manualmente.")
        }
    }

    return (
        <div className="space-y-3 rounded-xl border bg-slate-50/70 p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
                El portal ya muestra <span className="font-mono">https://</span> antes del campo y la ruta del servicio después.
                Escribe solo este valor en los tres campos:
            </p>
            {FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                    <p className="text-xs font-medium text-slate-700">{field.label}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded-md border bg-white px-3 py-1.5 font-mono text-sm">{urls.portalField}</code>
                        <span className="font-mono text-xs text-muted-foreground">{urls.paths[field.key]}</span>
                    </div>
                </div>
            ))}
            <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={copy} disabled={!urls.ready}>
                    <Copy className="mr-2 size-4" /> Copiar valor
                </Button>
                {!urls.ready && (
                    <p className="text-xs text-amber-700">
                        Configura el RNC de la empresa en Ajustes → Empresa para obtener el valor real.
                    </p>
                )}
            </div>
        </div>
    )
}
