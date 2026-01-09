"use client"

import { Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteInvoice } from "@/actions/invoice-actions"
import { useRouter } from "next/navigation"
// import { toast } from "sonner" // Using alert for now

export function DeleteInvoiceButton({ invoiceId }: { invoiceId: string }) {
    const router = useRouter()

    const handleDelete = async () => {
        if (!confirm("¿Estás seguro de eliminar esta factura?")) return

        const res = await deleteInvoice(invoiceId)
        if (res.success) {
            router.refresh()
        } else {
            alert(res.error) // Simple alert for now as I don't see Toaster in context
        }
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={handleDelete}
        >
            <Trash className="h-4 w-4" />
        </Button>
    )
}
