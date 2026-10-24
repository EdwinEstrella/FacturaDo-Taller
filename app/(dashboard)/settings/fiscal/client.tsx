"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateFiscalSequence } from "@/actions/fiscal-actions"
import { SettingsSection } from "@/components/modules/settings/settings-nav"

const SEQUENCES = [
    {
        type: "B01",
        title: "Crédito Fiscal (B01)",
        description: "Para clientes con RNC que necesitan deducir el ITBIS. Se asigna automáticamente a las facturas con impuesto.",
    },
    {
        type: "B02",
        title: "Consumidor Final (B02)",
        description: "Para ventas a personas o clientes que no requieren crédito fiscal.",
    },
] as const

export function FiscalSettingsClient({ b01, b02 }: { b01: string; b02: string }) {
    const initial = { B01: b01, B02: b02 }
    return (
        <div className="space-y-6">
            {SEQUENCES.map((s) => (
                <SequenceForm key={s.type} {...s} initial={initial[s.type]} />
            ))}
            <p className="px-1 text-xs text-muted-foreground">
                Cada número se usa una sola vez. Al cambiar una secuencia, la próxima factura tomará el número que escribas aquí.
            </p>
        </div>
    )
}

function SequenceForm({ type, title, description, initial }: {
    type: string
    title: string
    description: string
    initial: string
}) {
    const router = useRouter()
    const [value, setValue] = useState(initial)
    const [pending, startTransition] = useTransition()
    const normalized = value.trim().toUpperCase()
    const valid = new RegExp(`^${type}\\d{8}$`).test(normalized)
    const dirty = normalized !== initial

    const save = () => {
        startTransition(async () => {
            try {
                await updateFiscalSequence(type, normalized)
                toast.success(`Secuencia ${type} actualizada`)
                router.refresh()
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "No se pudo guardar la secuencia")
            }
        })
    }

    return (
        <SettingsSection
            title={title}
            description={description}
            footer={
                <Button onClick={save} disabled={!dirty || !valid || pending}>
                    {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar
                </Button>
            }
        >
            <div className="max-w-sm space-y-2">
                <label htmlFor={`ncf-${type}`} className="text-sm font-medium">Próximo número a usar</label>
                <Input
                    id={`ncf-${type}`}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={`${type}00000001`}
                    className="font-mono uppercase"
                    maxLength={11}
                />
                <p className={`text-xs ${value && !valid ? "text-red-600" : "text-muted-foreground"}`}>
                    {value && !valid
                        ? `Debe ser ${type} seguido de 8 dígitos`
                        : initial
                            ? `Guardado: ${initial}`
                            : "Todavía no hay secuencia configurada"}
                </p>
            </div>
        </SettingsSection>
    )
}
