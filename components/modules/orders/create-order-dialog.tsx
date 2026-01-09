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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { createWorkOrder } from "@/actions/order-actions"
import { useState } from "react"
import { Hammer } from "lucide-react"

export function CreateWorkOrderDialog({ invoiceId }: { invoiceId: string }) {
    const [open, setOpen] = useState(false)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Hammer className="mr-2 h-4 w-4" /> Producción
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Crear Orden de Trabajo</DialogTitle>
                    <DialogDescription>
                        Ingrese las medidas o especificaciones para producción.
                    </DialogDescription>
                </DialogHeader>
                <form action={async (formData) => {
                    const notes = formData.get("notes") as string
                    await createWorkOrder(invoiceId, notes)
                    setOpen(false)
                    alert("Orden de trabajo creada!")
                }}>
                    <div className="grid gap-4 py-4">
                        <div className="grid w-full gap-1.5">
                            <Label htmlFor="notes">Medidas / Notas</Label>
                            <Textarea id="notes" name="notes" placeholder="Ej: Gabinete 20x30, color blanco..." required />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit">Generar Orden</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
