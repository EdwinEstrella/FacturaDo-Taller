"use client"

import { useState } from "react"
import { Trash, Lock } from "lucide-react"
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
import { deleteInvoice } from "@/actions/invoice-actions"
import { useRouter } from "next/navigation"

interface DeleteInvoiceDialogProps {
    invoiceId: string
    isProduction?: boolean // Check if it has workOrder
}

export function DeleteInvoiceDialog({ invoiceId, isProduction }: DeleteInvoiceDialogProps) {
    const [open, setOpen] = useState(false)
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const router = useRouter()

    const handleDelete = async () => {
        if (!password) {
            setError("Ingrese la contraseña")
            return
        }

        setLoading(true)
        setError("")

        try {
            const res = await deleteInvoice(invoiceId, password)
            if (res.success) {
                setOpen(false)
                setPassword("")
                router.refresh()
            } else {
                setError(res.error || "Error al eliminar")
            }
        } catch (e) {
            setError("Error de conexión")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                    <Trash className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <Trash className="h-5 w-5" />
                        Eliminar Factura
                    </DialogTitle>
                    <DialogDescription>
                        Esta acción es irreversible.
                        {isProduction && " Esta factura está en PRODUCCIÓN, se requiere autorización de Administrador."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="password" className="text-right">
                            Contraseña
                        </Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="col-span-3"
                            placeholder="Contraseña de Admin"
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-500 text-center font-medium">{error}</p>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={loading}
                    >
                        {loading ? "Eliminando..." : "Confirmar Eliminación"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
