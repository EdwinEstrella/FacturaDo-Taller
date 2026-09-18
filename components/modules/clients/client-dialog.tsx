"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClientAction, updateClient } from "@/actions/client-actions"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Loader2 } from "lucide-react"
import type { Client } from "@/types"

export function ClientDialog({ client }: { client?: Client }) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [phone, setPhone] = useState(client?.phone || "")
    const isSubmittingRef = useRef(false)
    const router = useRouter()

    useEffect(() => {
        if (!open) {
            setIsPending(false)
            isSubmittingRef.current = false
            if (!client) {
                setPhone("")
            }
        } else {
            setPhone(client?.phone || "")
        }
    }, [open, client])

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '') // Remove non-digits
        if (val.length > 10) val = val.slice(0, 10) // Max 10 digits

        // Format: XXX-XXX-XXXX
        let formatted = val
        if (val.length > 6) {
            formatted = `${val.slice(0, 3)}-${val.slice(3, 6)}-${val.slice(6)}`
        } else if (val.length > 3) {
            formatted = `${val.slice(0, 3)}-${val.slice(3)}`
        }
        setPhone(formatted)
    }

    // Submit handler with strict synchronous double-submit locking
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        if (isSubmittingRef.current || isPending) {
            return
        }

        isSubmittingRef.current = true
        setIsPending(true)

        try {
            const formData = new FormData(e.currentTarget)
            formData.set("phone", phone)

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let res: any

            if (client) {
                res = await updateClient(client.id, null, formData)
            } else {
                res = await createClientAction(null, formData)
            }

            if (res?.success) {
                setOpen(false)
                router.refresh()
            } else {
                const errorMsg = res?.message || (res?.errors ? Object.values(res.errors).flat().join("\n") : "Error al procesar cliente")
                alert(errorMsg)
            }
        } catch (err) {
            console.error("Error submitting client:", err)
            alert("Ocurrió un error al guardar el cliente")
        } finally {
            isSubmittingRef.current = false
            setIsPending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {client ? (
                    <Button variant="ghost" size="icon" title="Editar Cliente">
                        <Pencil className="h-4 w-4 text-blue-500" />
                    </Button>
                ) : (
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Agregar Cliente
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{client ? "Editar Cliente" : "Agregar Cliente"}</DialogTitle>
                    <DialogDescription>
                        {client ? "Modifique los datos del cliente." : "Crear un nuevo perfil de cliente."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Nombre *
                            </Label>
                            <Input id="name" name="name" defaultValue={client?.name} className="col-span-3" required autoFocus />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="rnc" className="text-right">
                                RNC
                            </Label>
                            <Input id="rnc" name="rnc" defaultValue={client?.rnc || ""} className="col-span-3" placeholder="RNC de la empresa (si aplica)" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="cedula" className="text-right">
                                Cédula
                            </Label>
                            <Input id="cedula" name="cedula" defaultValue={client?.cedula || ""} className="col-span-3" placeholder="Cédula de identidad (si aplica)" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="phone" className="text-right">
                                Teléfono
                            </Label>
                            <Input
                                id="phone"
                                name="phone"
                                value={phone}
                                onChange={handlePhoneChange}
                                className="col-span-3"
                                placeholder="809-555-0101"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="email" className="text-right">
                                Email
                            </Label>
                            <Input id="email" name="email" type="email" defaultValue={client?.email || ""} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="address" className="text-right">
                                Dirección
                            </Label>
                            <Input id="address" name="address" defaultValue={client?.address || ""} className="col-span-3" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                                </>
                            ) : (
                                "Guardar"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
