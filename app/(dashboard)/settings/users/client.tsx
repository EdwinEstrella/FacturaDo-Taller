"use client"

import { useState } from "react"
import { Plus, Pencil, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { createUser, updateUser, deleteUser } from "@/actions/user-actions"
import { useRouter } from "next/navigation"

interface User {
    id: string
    name: string
    username: string
    role: string
    createdAt: Date
    updatedAt: Date
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function UsersClient({ initialUsers }: { initialUsers: any[] }) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [currentUser, setCurrentUser] = useState<any>(null) // For editing

    // Form State for Create/Edit
    const [formData, setFormData] = useState({
        name: "",
        username: "",
        password: "",
        role: "SELLER"
    })

    const handleCreate = async () => {
        setLoading(true)
        const res = await createUser({ ...formData, role: formData.role as any })
        setLoading(false)

        if (res.success) {
            setIsOpen(false)
            setFormData({ name: "", username: "", password: "", role: "SELLER" })
            router.refresh()
        } else {
            alert(res.error)
        }
    }

    const openEdit = (user: any) => {
        setCurrentUser(user)
        setFormData({
            name: user.name,
            username: user.username,
            password: "", // Don't show current password
            role: user.role
        })
        setIsEditOpen(true)
    }

    const handleUpdate = async () => {
        if (!currentUser) return
        setLoading(true)
        const res = await updateUser(currentUser.id, { ...formData, role: formData.role as any })
        setLoading(false)

        if (res.success) {
            setIsEditOpen(false)
            setCurrentUser(null)
            router.refresh()
        } else {
            alert(res.error)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este usuario?")) return
        const res = await deleteUser(id)
        if (res.success) {
            router.refresh()
        } else {
            alert(res.error)
        }
    }

    // Helper to translate Role
    const getRoleName = (role: string) => {
        if (role === 'ADMIN') return 'Administrador'
        if (role === 'SELLER') return 'Vendedor'
        if (role === 'ACCOUNTANT') return 'Contador'
        return role
    }

    return (
        <div>
            <div className="flex justify-end mb-4">
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Nuevo Usuario
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Usuario</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Nombre</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Usuario (Login)</Label>
                                <Input
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Contraseña</Label>
                                <Input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Rol</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(val) => setFormData({ ...formData, role: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar Rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ADMIN">Administrador</SelectItem>
                                        <SelectItem value="SELLER">Vendedor</SelectItem>
                                        <SelectItem value="ACCOUNTANT">Contador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={handleCreate} disabled={loading}>
                                {loading ? "Creando..." : "Crear"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialUsers.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.name}</TableCell>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                                        user.role === 'ACCOUNTANT' ? 'bg-green-100 text-green-800' :
                                            'bg-blue-100 text-blue-800'
                                        }`}>
                                        {getRoleName(user.role)}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(user.id)}>
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* EDIT DIALOG */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Usuario</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Nombre</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Usuario (Login)</Label>
                            <Input
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Nueva Contraseña (Dejar vacío para mantener actual)</Label>
                            <Input
                                type="password"
                                placeholder="******"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Rol</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(val) => setFormData({ ...formData, role: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar Rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ADMIN">Administrador</SelectItem>
                                    <SelectItem value="SELLER">Vendedor</SelectItem>
                                    <SelectItem value="ACCOUNTANT">Contador</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleUpdate} disabled={loading}>
                            {loading ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
