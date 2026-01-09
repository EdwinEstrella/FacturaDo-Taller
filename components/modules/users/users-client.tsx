"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserPlus, Trash2 } from "lucide-react"
import { UserDialog } from "./user-dialog"
import { deleteUser } from "@/actions/user-actions"
import { useRouter } from "next/navigation"

interface User {
    id: string
    name: string
    username: string
    role: string
    createdAt: Date
}

export function UsersClient({ users }: { users: User[] }) {
    const router = useRouter()
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const handleDelete = async (id: string) => {
        if (confirm("¿Estás seguro de que quieres eliminar este usuario?")) {
            await deleteUser(id)
            router.refresh()
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h2>
                <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Nuevo Usuario
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Usuarios del Sistema</CardTitle>
                </CardHeader>
                <CardContent>
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
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell>{user.username}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                                user.role === 'ACCOUNTANT' ? 'bg-green-100 text-green-700' :
                                                    'bg-blue-100 text-blue-700'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(user.id)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <UserDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
        </div>
    )
}
