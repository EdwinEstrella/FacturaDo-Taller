"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateInstallationState, updateInstallationPhotos } from "@/actions/installation-actions"
import { toast } from "sonner"
import { X, Plus, Camera, Package, User, Clock, CheckCircle2, AlertCircle } from "lucide-react"

interface Installation {
    id: string
    productName: string
    quantity: number
    clientName: string
    clientAddress?: string | null
    clientPhone?: string | null
    estado: string
    tecnicoAsignado?: string | null
    fechaCreacion: string
    fechaEnProduccion?: string | null
    fechaListaDespacho?: string | null
    fechaPendienteInstalacion?: string | null
    fechaInstalada?: string | null
    fotos?: string | null
    notas?: string | null
}

const ESTADOS = {
    Pendiente: { label: "Pendiente", color: "bg-gray-100 text-gray-800" },
    EnProduccion: { label: "En Producción", color: "bg-blue-100 text-blue-800" },
    ListaDespacho: { label: "Lista para Despacho", color: "bg-yellow-100 text-yellow-800" },
    PendienteInstalacion: { label: "Pendiente de Instalación", color: "bg-orange-100 text-orange-800" },
    Instalada: { label: "Instalada", color: "bg-green-100 text-green-800" }
}

interface PendientesClientProps {
    installations: Installation[]
    pendingCount: number
    currentUser?: {
        id: string
        name: string | null
        username: string
        role: string
    } | null
}

export function PendientesClient({ installations, pendingCount, currentUser }: PendientesClientProps) {
    const router = useRouter()
    const user = currentUser

    const [photoDialog, setPhotoDialog] = useState<{
        open: boolean
        installation: Installation | null
    }>({ open: false, installation: null })

    const handleStateChange = async (installationId: string, newState: string) => {
        // Si va a marcar como Instalada, verificar que tenga fotos
        if (newState === 'Instalada') {
            const installation = installations.find(i => i.id === installationId)
            if (installation) {
                const currentPhotos = installation.fotos ? JSON.parse(installation.fotos) : []
                if (currentPhotos.length === 0) {
                    setPhotoDialog({ open: true, installation })
                    return
                }
            }
        }

        const result = await updateInstallationState(installationId, newState, user?.id)
        if (result.success) {
            toast.success("Estado actualizado correctamente")
            router.refresh()
        } else {
            toast.error("Error al actualizar estado: " + result.error)
        }
    }

    const handleStateChangeForce = async (installationId: string, newState: string) => {
        const result = await updateInstallationState(installationId, newState, user?.id)
        if (result.success) {
            toast.success("Estado actualizado correctamente")
            router.refresh()
        } else {
            toast.error("Error al actualizar estado: " + result.error)
        }
    }

    const getFilteredInstallations = (estado: string) => {
        return installations.filter(i => i.estado === estado)
    }

    const canChangeState = (installation: Installation, newState: string) => {
        // Admin puede cambiar cualquier estado
        if (user?.role === 'ADMIN') return true

        // Técnico puede mover: Pendiente → EnProduccion → ListaDespacho
        if (user?.role === 'TECNICIAN') {
            if (installation.estado === 'Pendiente' && newState === 'EnProduccion') return true
            if (installation.estado === 'EnProduccion' && newState === 'ListaDespacho') return true
            return false
        }

        // Ventas puede mover: ListaDespacho → PendienteInstalacion
        if (user?.role === 'SALES') {
            if (installation.estado === 'ListaDespacho' && newState === 'PendienteInstalacion') return true
            return false
        }

        return false
    }

    const getNextStates = (currentState: string) => {
        const states: string[] = []

        if (user?.role === 'ADMIN') {
            // Admin puede cambiar a cualquier estado
            Object.keys(ESTADOS).forEach(key => {
                if (key !== currentState) states.push(key)
            })
        } else if (user?.role === 'TECNICIAN') {
            if (currentState === 'Pendiente') states.push('EnProduccion')
            if (currentState === 'EnProduccion') states.push('ListaDespacho')
        } else if (user?.role === 'SALES') {
            if (currentState === 'ListaDespacho') states.push('PendienteInstalacion')
        }

        return states
    }

    return (
        <div className="space-y-6">
            <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNMCAwaDQwdjQwSDBIMCIgZmlsbD0ibm9uZSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIgb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-20"></div>
                <div className="relative">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-lg">
                                Pendientes de Instalación
                            </h1>
                            <p className="mt-2 text-slate-300">
                                Gestiona el flujo de producción, despacho e instalación
                            </p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                                <div className="text-center">
                                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-cyan-400">
                                        {pendingCount}
                                    </div>
                                    <div className="text-xs text-slate-300 mt-1 uppercase tracking-wider font-semibold">Pendientes</div>
                                </div>
                                <div className="h-16 w-px bg-white/20"></div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Clock className="h-4 w-4 text-amber-400" />
                                        <span className="text-slate-200">Tiempo real</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                        <span className="text-slate-200">Automático</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="todos" className="space-y-4">
                <TabsList className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <TabsTrigger value="todos" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                        <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            <span>Todos ({installations.length})</span>
                        </div>
                    </TabsTrigger>
                    {user?.role === 'TECNICIAN' && (
                        <>
                            <TabsTrigger value="pedidos" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-amber-600 data-[state=active]:text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>Pedidos ({getFilteredInstallations('Pendiente').length})</span>
                                </div>
                            </TabsTrigger>
                            <TabsTrigger value="produccion" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    <span>En Producción ({getFilteredInstallations('EnProduccion').length})</span>
                                </div>
                            </TabsTrigger>
                            <TabsTrigger value="despacho" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-600 data-[state=active]:to-orange-600 data-[state=active]:text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    <span>Lista Despacho ({getFilteredInstallations('ListaDespacho').length})</span>
                                </div>
                            </TabsTrigger>
                        </>
                    )}
                    {user?.role === 'SALES' && (
                        <>
                            <TabsTrigger value="despacho" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-600 data-[state=active]:to-orange-600 data-[state=active]:text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    <span>Despacho ({getFilteredInstallations('ListaDespacho').length})</span>
                                </div>
                            </TabsTrigger>
                            <TabsTrigger value="instalacion" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>Instalación ({getFilteredInstallations('PendienteInstalacion').length})</span>
                                </div>
                            </TabsTrigger>
                        </>
                    )}
                    {user?.role === 'ADMIN' && (
                        <>
                            <TabsTrigger value="pedidos" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-amber-600 data-[state=active]:text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>Pedidos</span>
                                </div>
                            </TabsTrigger>
                            <TabsTrigger value="produccion" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    <span>Producción</span>
                                </div>
                            </TabsTrigger>
                            <TabsTrigger value="despacho" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-600 data-[state=active]:to-orange-600 data-[state=active]:text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    <span>Despacho</span>
                                </div>
                            </TabsTrigger>
                            <TabsTrigger value="instalacion" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>Instalación</span>
                                </div>
                            </TabsTrigger>
                            <TabsTrigger value="completadas" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-green-600 data-[state=active]:text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>Completadas</span>
                                </div>
                            </TabsTrigger>
                        </>
                    )}
                </TabsList>

                <TabsContent value="todos" className="space-y-4">
                    <InstallationsTable
                        installations={installations}
                        onStateChange={handleStateChange}
                        canChangeState={canChangeState}
                        getNextStates={getNextStates}
                        onManagePhotos={(installation) => setPhotoDialog({ open: true, installation })}
                    />
                </TabsContent>

                <TabsContent value="pedidos" className="space-y-4">
                    <InstallationsTable
                        installations={getFilteredInstallations('Pendiente')}
                        onStateChange={handleStateChange}
                        canChangeState={canChangeState}
                        getNextStates={getNextStates}
                        onManagePhotos={(installation) => setPhotoDialog({ open: true, installation })}
                    />
                </TabsContent>

                <TabsContent value="produccion" className="space-y-4">
                    <InstallationsTable
                        installations={getFilteredInstallations('EnProduccion')}
                        onStateChange={handleStateChange}
                        canChangeState={canChangeState}
                        getNextStates={getNextStates}
                    />
                </TabsContent>

                <TabsContent value="despacho" className="space-y-4">
                    <InstallationsTable
                        installations={getFilteredInstallations('ListaDespacho')}
                        onStateChange={handleStateChange}
                        canChangeState={canChangeState}
                        getNextStates={getNextStates}
                    />
                </TabsContent>

                <TabsContent value="instalacion" className="space-y-4">
                    <InstallationsTable
                        installations={getFilteredInstallations('PendienteInstalacion')}
                        onStateChange={handleStateChange}
                        canChangeState={canChangeState}
                        getNextStates={getNextStates}
                    />
                </TabsContent>

                <TabsContent value="completadas" className="space-y-4">
                    <InstallationsTable
                        installations={getFilteredInstallations('Instalada')}
                        onStateChange={handleStateChange}
                        canChangeState={canChangeState}
                        getNextStates={getNextStates}
                    />
                </TabsContent>
            </Tabs>

            <PhotoDialog
                open={photoDialog.open}
                installation={photoDialog.installation}
                onClose={() => setPhotoDialog({ open: false, installation: null })}
                onStateChange={handleStateChangeForce}
            />
        </div>
    )
}

interface InstallationsTableProps {
    installations: Installation[]
    onStateChange: (id: string, newState: string) => void
    canChangeState: (installation: Installation, newState: string) => boolean
    getNextStates: (currentState: string) => string[]
    onManagePhotos?: (installation: Installation) => void
}

function InstallationsTable({ installations, onStateChange, canChangeState, getNextStates, onManagePhotos }: InstallationsTableProps) {
    if (installations.length === 0) {
        return (
            <Card className="border-2 border-dashed border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                <CardContent className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <Package className="h-16 w-16 text-slate-300 dark:text-slate-600" />
                        <p className="text-lg font-medium text-slate-500 dark:text-slate-400">
                            No hay instalaciones en esta categoría
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-0 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6 border-b border-slate-200 dark:border-slate-700">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                    Instalaciones
                </CardTitle>
            </div>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800">
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Producto</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Cliente</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Cantidad</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Estado</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Fecha</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {installations.map((installation, index) => (
                            <TableRow
                                key={installation.id}
                                className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                                style={{
                                    animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`
                                }}
                            >
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs shadow-md">
                                            {installation.productName.charAt(0)}
                                        </div>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {installation.productName}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-slate-400" />
                                        <div>
                                            <div className="font-medium text-slate-800 dark:text-slate-200">{installation.clientName}</div>
                                            {installation.clientAddress && (
                                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                    <span>{installation.clientAddress}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center justify-center">
                                        <div className="bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1 font-bold text-slate-700 dark:text-slate-300">
                                            {installation.quantity}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        className={`${ESTADOS[installation.estado as keyof typeof ESTADOS].color} border-2 shadow-sm font-semibold text-xs px-3 py-1`}
                                    >
                                        {ESTADOS[installation.estado as keyof typeof ESTADOS].label}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                        <Clock className="h-4 w-4" />
                                        <span>{new Date(installation.fechaCreacion).toLocaleDateString('es-DO')}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <ActionsDropdown
                                        installation={installation}
                                        onStateChange={onStateChange}
                                        canChangeState={canChangeState}
                                        getNextStates={getNextStates}
                                        onManagePhotos={onManagePhotos}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

function ActionsDropdown({ installation, onStateChange, canChangeState, getNextStates, onManagePhotos }: {
    installation: Installation
    onStateChange: (id: string, newState: string) => void
    canChangeState: (installation: Installation, newState: string) => boolean
    getNextStates: (currentState: string) => string[]
    onManagePhotos?: (installation: Installation) => void
}) {
    const nextStates = getNextStates(installation.estado)
    const hasPhotos = installation.fotos && JSON.parse(installation.fotos).length > 0

    const getButtonVariant = (state: string) => {
        switch (state) {
            case 'EnProduccion': return 'default bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300'
            case 'ListaDespacho': return 'default bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300'
            case 'PendienteInstalacion': return 'default bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300'
            case 'Instalada': return 'default bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300'
            default: return 'default bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300'
        }
    }

    return (
        <div className="flex gap-2 flex-wrap justify-end">
            {nextStates.map((state) => (
                <Button
                    key={state}
                    size="sm"
                    variant="outline"
                    className={getButtonVariant(state)}
                    onClick={() => onStateChange(installation.id, state)}
                    disabled={!canChangeState(installation, state)}
                >
                    {ESTADOS[state as keyof typeof ESTADOS].label}
                </Button>
            ))}
            {onManagePhotos && (
                <Button
                    size="sm"
                    variant={hasPhotos ? "default" : "outline"}
                    className={hasPhotos
                        ? "bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                        : "border-2 border-dashed border-pink-300 text-pink-600 hover:bg-pink-50 hover:border-pink-400 transition-all duration-300"
                    }
                    onClick={() => onManagePhotos(installation)}
                >
                    <Camera className="h-3 w-3 mr-1" />
                    {hasPhotos ? `${JSON.parse(installation.fotos || '[]').length} Fotos` : "Agregar Fotos"}
                </Button>
            )}
        </div>
    )
}

interface PhotoDialogProps {
    open: boolean
    installation: Installation | null
    onClose: () => void
    onStateChange: (id: string, newState: string) => void
}

function PhotoDialog({ open, installation, onClose, onStateChange }: PhotoDialogProps) {
    const [photos, setPhotos] = useState<string[]>([])
    const [newPhotoUrl, setNewPhotoUrl] = useState("")
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)

    // Load existing photos when installation changes
    useEffect(() => {
        if (installation?.fotos) {
            try {
                setPhotos(JSON.parse(installation.fotos))
            } catch {
                setPhotos([])
            }
        } else {
            setPhotos([])
        }
    }, [installation])

    const handleAddPhoto = () => {
        if (newPhotoUrl.trim() && photos.length < 5) {
            setPhotos([...photos, newPhotoUrl.trim()])
            setNewPhotoUrl("")
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !installation || photos.length >= 5) return

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("installationId", installation.id)

            const response = await fetch("/api/installations/photos/upload", {
                method: "POST",
                body: formData,
            })

            const result = await response.json()

            if (result.success) {
                setPhotos([...photos, result.url])
                toast.success("Foto subida correctamente")
            } else {
                toast.error("Error: " + result.error)
            }
        } catch (error) {
            console.error("Error uploading photo:", error)
            toast.error("Error al subir foto")
        } finally {
            setUploading(false)
            // Reset input
            e.target.value = ""
        }
    }

    const handleRemovePhoto = (index: number) => {
        setPhotos(photos.filter((_, i) => i !== index))
    }

    const handleSavePhotos = async () => {
        if (!installation) return

        setLoading(true)
        const result = await updateInstallationPhotos(installation.id, photos)
        setLoading(false)

        if (result.success) {
            toast.success("Fotos actualizadas correctamente")
            onClose()
        } else {
            toast.error("Error: " + result.error)
        }
    }

    const handleMarkAsInstalled = () => {
        if (!installation || photos.length === 0) {
            toast.error("Debes agregar al menos una foto antes de marcar como instalada")
            return
        }

        handleSavePhotos().then(() => {
            onStateChange(installation.id, 'Instalada')
            onClose()
        })
    }

    return (
        <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        Fotos de Instalación
                    </DialogTitle>
                    <DialogDescription>
                        {installation && (
                            <span>
                                {installation.productName} - {installation.clientName}
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Add new photo by URL */}
                    <div className="space-y-2">
                        <Label>Opción 1: Agregar por URL</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="https://ejemplo.com/foto.jpg"
                                value={newPhotoUrl}
                                onChange={(e) => setNewPhotoUrl(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddPhoto()}
                                disabled={photos.length >= 5 || uploading}
                            />
                            <Button
                                onClick={handleAddPhoto}
                                disabled={!newPhotoUrl.trim() || photos.length >= 5 || uploading}
                                type="button"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                                O
                            </span>
                        </div>
                    </div>

                    {/* Add new photo by upload */}
                    <div className="space-y-2">
                        <Label>Opción 2: Subir archivo</Label>
                        <div className="flex gap-2">
                            <Input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleFileUpload}
                                disabled={photos.length >= 5 || uploading}
                                className="flex-1"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Máximo 5MB por foto. Formatos: JPG, PNG, WEBP
                        </p>
                    </div>

                    {/* Photos grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {photos.map((photo, index) => (
                            <div key={index} className="relative group">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={photo}
                                    alt={`Foto ${index + 1}`}
                                    className="w-full h-32 object-cover rounded-md border shadow-sm hover:shadow-md transition-shadow duration-300"
                                    onError={(e) => {
                                        e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='12' fill='%23999'%3EError%3C/text%3E%3C/svg%3E"
                                    }}
                                />
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleRemovePhoto(index)}
                                    type="button"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                                <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                                    {index + 1}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Empty slots indicator */}
                    <p className="text-sm text-muted-foreground">
                        {photos.length}/5 fotos agregadas
                    </p>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={loading || uploading}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSavePhotos}
                        disabled={loading || uploading || photos.length === 0}
                    >
                        {loading ? "Guardando..." : "Guardar Fotos"}
                    </Button>
                    <Button
                        onClick={handleMarkAsInstalled}
                        disabled={loading || uploading || photos.length === 0}
                    >
                        {loading ? "Procesando..." : "Guardar y Marcar como Instalada"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
