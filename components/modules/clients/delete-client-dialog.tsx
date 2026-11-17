"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { deleteClient } from "@/actions/client-actions"
import { toast } from "sonner"
import { useTransition } from "react"
import { useRouter } from "next/navigation"

interface DeleteClientDialogProps {
    clientId: string
    clientName: string
}

export function DeleteClientDialog({ clientId, clientName }: DeleteClientDialogProps) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleDelete = () => {
        startTransition(async () => {
            const res = await deleteClient(clientId)
            if (!res.success) {
                toast.error(res.error || "No se pudo eliminar el cliente")
                return
            }
            toast.success(res.archived
                ? `${clientName} tiene facturas o cotizaciones: se archivó y ya no aparecerá en las listas.`
                : `${clientName} fue eliminado.`)
            router.refresh()
        })
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Se eliminará al cliente <b>{clientName}</b>.
                        <br /><br />
                        Si tiene facturas o cotizaciones, se archivará: deja de aparecer en las listas y en el Punto de Venta, pero su historial se conserva.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700" disabled={isPending}>
                        {isPending ? "Eliminando..." : "Eliminar"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
