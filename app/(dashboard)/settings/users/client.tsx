"use client"

import { useState } from "react"
import { Plus, Pencil, Trash, Check } from "lucide-react"
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

type UserRole = "ADMIN" | "SELLER" | "ACCOUNTANT" | "TECHNICIAN" | "MANAGER" | "CUSTOM"

interface User {
    id: string
    name: string | null
    username: string
    password: string
    role: UserRole
    customPermissions?: Record<string, unknown> | null
    createdAt: Date
    updatedAt: Date
}

interface CreateUserFormData {
    name: string | null
    username: string
    password: string
    role: UserRole
    customPermissions?: Record<string, boolean>
}

// Define available permissions
const AVAILABLE_PERMISSIONS = {
    invoices: {
        create: "Crear Facturas",
        read: "Ver Facturas",
        update: "Editar Facturas",
        delete: "Eliminar Facturas",
    },
    quotes: {
        create: "Crear Cotizaciones",
        read: "Ver Cotizaciones",
        update: "Editar Cotizaciones",
        delete: "Eliminar Cotizaciones",
    },
    clients: {
        create: "Crear Clientes",
        read: "Ver Clientes",
        update: "Editar Clientes",
        delete: "Eliminar Clientes",
    },
    products: {
        create: "Crear Productos",
        read: "Ver Productos",
        update: "Editar Productos",
        delete: "Eliminar Productos",
    },
    reports: {
        view: "Ver Reportes",
        export: "Exportar Reportes",
    },
    settings: {
        users: "Gestionar Usuarios",
    },
}

export function UsersClient({ initialUsers }: { initialUsers: User[] }) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [currentUser, setCurrentUser] = useState<User | null>(null)

    // Form State for Create/Edit
    const [formData, setFormData] = useState<CreateUserFormData>({
        name: "",
        username: "",
        password: "",
        role: "SELLER",
        customPermissions: {}
    })

    // Helper to get default permissions based on role
    const getDefaultPermissions = (role: UserRole): Record<string, boolean> => {
        switch (role) {
            case "ADMIN":
                return { all: true }
            case "SELLER":
                return {
                    "invoices.create": true,
                    "invoices.read": true,
                    "clients.read": true,
                    "products.read": true,
                }
            case "ACCOUNTANT":
                return {
                    "invoices.read": true,
                    "invoices.update": true,
                    "reports.view": true,
                    "reports.export": true,
                }
            case "TECHNICIAN":
                return {
                    "invoices.read": true,
                }
            case "MANAGER":
                return {
                    "invoices.read": true,
                    "clients.read": true,
                    "products.read": true,
                    "reports.view": true,
                }
            case "CUSTOM":
            default:
                return {}
        }
    }

    // Toggle permission
    const togglePermission = (key: string) => {
        setFormData(prev => ({
            ...prev,
            customPermissions: {
                ...(prev.customPermissions || {}),
                [key]: !(prev.customPermissions?.[key] || false)
            }
        }))
    }

    const handleCreate = async () => {
        setLoading(true)
        const res = await createUser({
            ...formData,
            customPermissions: formData.role === "CUSTOM" ? formData.customPermissions : undefined
        })
        setLoading(false)

        if (res.success) {
            setIsOpen(false)
            setFormData({ name: "", username: "", password: "", role: "SELLER", customPermissions: {} })
            router.refresh()
        } else {
            alert(res.error)
        }
    }

    const openEdit = (user: User) => {
        setCurrentUser(user)
        setFormData({
            name: user.name,
            username: user.username,
            password: "", // Don't show current password
            role: user.role,
            customPermissions: (user.customPermissions as Record<string, boolean>) || {}
        })
        setIsEditOpen(true)
    }

    const handleUpdate = async () => {
        if (!currentUser) return
        setLoading(true)
        const res = await updateUser(currentUser.id, {
            ...formData,
            customPermissions: formData.role === "CUSTOM" ? formData.customPermissions : undefined
        })
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
        if (role === 'TECHNICIAN') return 'Técnico'
        if (role === 'MANAGER') return 'Supervisor'
        if (role === 'CUSTOM') return 'Personalizado'
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
                                    value={formData.name || ""}
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
                                    onValueChange={(val: UserRole) => {
                                        setFormData({ ...formData, role: val, customPermissions: getDefaultPermissions(val) })
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar Rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ADMIN">Administrador</SelectItem>
                                        <SelectItem value="SELLER">Vendedor</SelectItem>
                                        <SelectItem value="ACCOUNTANT">Contador</SelectItem>
                                        <SelectItem value="TECHNICIAN">Técnico</SelectItem>
                                        <SelectItem value="MANAGER">Supervisor</SelectItem>
                                        <SelectItem value="CUSTOM">Personalizado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.role === "CUSTOM" && (
                                <div className="grid gap-3 mt-4 p-4 bg-gray-50 rounded-lg border">
                                    <Label className="font-semibold">Permisos Personalizados</Label>
                                    <p className="text-xs text-gray-500 mb-2">Selecciona los permisos específicos para este usuario:</p>
                                    {Object.entries(AVAILABLE_PERMISSIONS).map(([category, perms]) => (
                                                                        <div key={category} className="space-y-2">
                                                                            <p className="text-xs font-medium capitalize text-gray-700 border-b pb-1">
                                                                                {category === "invoices" ? "Facturas" :
                                                                                 category === "quotes" ? "Cotizaciones" :
                                                                                 category === "clients" ? "Clientes" :
                                                                                 category === "products" ? "Productos" :
                                                                                 category === "reports" ? "Reportes" :
                                                                                 category === "settings" ? "Configuración" : category}
                                                                            </p>
                                                                            <div className="grid grid-cols-2 gap-2 pl-2">
                                                                                {Object.entries(perms).map(([key, label]) => {
                                                                                    const permKey = `${category}.${key}`
                                                                                    const isChecked = formData.customPermissions?.[permKey] || false
                                                                                    return (
                                                                                        <button
                                                                                            key={permKey}
                                                                                            type="button"
                                                                                            onClick={() => togglePermission(permKey)}
                                                                                            className={`flex items-center gap-2 p-2 text-xs rounded border transition ${
                                                                                                isChecked
                                                                                                    ? "bg-blue-50 border-blue-500 text-blue-700"
                                                                                                    : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                                                                                            }`}
                                                                                        >
                                                                                            <Check className={`h-3 w-3 ${isChecked ? "opacity-100" : "opacity-0"}`} />
                                                                                            <span className="text-left">{label}</span>
                                                                                        </button>
                                                                                    )
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                </div>
                            )}
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
                                <TableCell className="font-medium">{user.name || ""}</TableCell>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                                        user.role === 'ACCOUNTANT' ? 'bg-green-100 text-green-800' :
                                        user.role === 'TECHNICIAN' ? 'bg-orange-100 text-orange-800' :
                                        user.role === 'MANAGER' ? 'bg-indigo-100 text-indigo-800' :
                                        user.role === 'CUSTOM' ? 'bg-yellow-100 text-yellow-800' :
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
                                value={formData.name || ""}
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
                                onValueChange={(val: UserRole) => {
                                    setFormData({ ...formData, role: val, customPermissions: getDefaultPermissions(val) })
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar Rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ADMIN">Administrador</SelectItem>
                                    <SelectItem value="SELLER">Vendedor</SelectItem>
                                    <SelectItem value="ACCOUNTANT">Contador</SelectItem>
                                    <SelectItem value="TECHNICIAN">Técnico</SelectItem>
                                    <SelectItem value="MANAGER">Supervisor</SelectItem>
                                    <SelectItem value="CUSTOM">Personalizado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {formData.role === "CUSTOM" && (
                            <div className="grid gap-3 mt-4 p-4 bg-gray-50 rounded-lg border">
                                <Label className="font-semibold">Permisos Personalizados</Label>
                                <p className="text-xs text-gray-500 mb-2">Selecciona los permisos específicos para este usuario:</p>
                                {Object.entries(AVAILABLE_PERMISSIONS).map(([category, perms]) => (
                                    <div key={category} className="space-y-2">
                                        <p className="text-xs font-medium capitalize text-gray-700 border-b pb-1">
                                            {category === "invoices" ? "Facturas" :
                                             category === "quotes" ? "Cotizaciones" :
                                             category === "clients" ? "Clientes" :
                                             category === "products" ? "Productos" :
                                             category === "reports" ? "Reportes" :
                                             category === "settings" ? "Configuración" : category}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 pl-2">
                                            {Object.entries(perms).map(([key, label]) => {
                                                const permKey = `${category}.${key}`
                                                const isChecked = formData.customPermissions?.[permKey] || false
                                                return (
                                                    <button
                                                        key={permKey}
                                                        type="button"
                                                        onClick={() => togglePermission(permKey)}
                                                        className={`flex items-center gap-2 p-2 text-xs rounded border transition ${
                                                            isChecked
                                                                ? "bg-blue-50 border-blue-500 text-blue-700"
                                                                : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                                                        }`}
                                                    >
                                                        <Check className={`h-3 w-3 ${isChecked ? "opacity-100" : "opacity-0"}`} />
                                                        <span className="text-left">{label}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
