"use client"

import { useState, useTransition } from "react"
import { Download, FileSignature, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signXmlDocument } from "@/actions/ecf-actions"

function signedFileName(original: string) {
    const base = original.replace(/\.xml$/i, "") || "documento"
    return `${base}_firmado.xml`
}

function downloadXml(content: string, fileName: string) {
    const url = URL.createObjectURL(new Blob([content], { type: "application/xml;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}

export function XmlSigner() {
    const [xmlName, setXmlName] = useState("")
    const [error, setError] = useState("")
    const [signed, setSigned] = useState<{ content: string; fileName: string } | null>(null)
    const [pending, startTransition] = useTransition()

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError("")
        setSigned(null)
        const formData = new FormData(event.currentTarget)
        startTransition(async () => {
            const result = await signXmlDocument(formData)
            if (!result.success) {
                setError(result.error)
                return
            }
            const fileName = signedFileName(xmlName)
            setSigned({ content: result.signedXml, fileName })
            downloadXml(result.signedXml, fileName)
            toast.success("XML firmado y descargado")
        })
    }

    return (
        <form onSubmit={submit} className="max-w-md space-y-4 rounded-lg border bg-slate-50 p-4">
            <div>
                <p className="text-sm font-semibold text-slate-900">Firmar XML con tu certificado</p>
                <p className="text-xs leading-relaxed text-slate-500">
                    Se firma con el certificado digital que ya guardaste en el sistema.
                </p>
            </div>
            <div className="space-y-2">
                <label htmlFor="ecf-sign-xml" className="text-sm font-medium">XML a firmar</label>
                <Input
                    id="ecf-sign-xml"
                    name="xml"
                    type="file"
                    accept=".xml,text/xml,application/xml"
                    onChange={(e) => { setXmlName(e.target.files?.[0]?.name ?? ""); setSigned(null) }}
                />
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending || !xmlName}>
                    {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileSignature className="mr-2 size-4" />}
                    Firmar y descargar
                </Button>
                {signed && (
                    <Button type="button" variant="outline" onClick={() => downloadXml(signed.content, signed.fileName)}>
                        <Download className="mr-2 size-4" /> Descargar de nuevo
                    </Button>
                )}
            </div>
        </form>
    )
}
