"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createUser } from "@/actions/user-actions"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function UserDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [role, setRole] = useState("SELLER")

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.currentTarget)

        const data = {
            name: formData.get("name") as string,
            username: formData.get("username") as string,
            password: formData.get("password") as string,
            role: role as any
        }

        const res = await createUser(data)

        if (res.success) {
            onOpenChange(false)
            router.refresh()
        } else {
            alert(res.error)
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Crear Usuario</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Nombre Completo</Label>
                        <Input id="name" name="name" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="username">Nombre de Usuario (Login)</Label>
                        <Input id="username" name="username" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input id="password" name="password" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="role">Rol</Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar rol" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="SELLER">Vendedor</SelectItem>
                                <SelectItem value="ACCOUNTANT">Contador</SelectItem>
                                <SelectItem value="ADMIN">Administrador</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {loading ? "Guardando..." : "Crear Usuario"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
