"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { MapPin, Package, Camera, CheckCircle, Clock, Truck } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Image from "next/image"

interface DispatchCardProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dispatch: any
    onUpdateStatus: (dispatchId: string, status: string, notes: string, photos: string[]) => Promise<void>
}

export function DispatchCard({ dispatch, onUpdateStatus }: DispatchCardProps) {
    const [open, setOpen] = useState(false)
    const [notes, setNotes] = useState("")
    const [photos, setPhotos] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)

    const invoice = dispatch.invoice
    const client = invoice?.client

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return

        setUploading(true)
        try {
            // Aquí iría la lógica de subida a Supabase Storage
            // Por ahora, simulamos con URLs locales
            const newPhotos: string[] = []
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const reader = new FileReader()
                const promise = new Promise<string>((resolve) => {
                    reader.onload = (e) => resolve(e.target?.result as string)
                    reader.readAsDataURL(file)
                })
                const dataUrl = await promise
                newPhotos.push(dataUrl)
            }
            setPhotos([...photos, ...newPhotos])
        } finally {
            setUploading(false)
        }
    }

    const handleStatusUpdate = async (newStatus: string) => {
        await onUpdateStatus(dispatch.id, newStatus, notes, photos)
        setOpen(false)
        setNotes("")
        setPhotos([])
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-800'
            case 'ASSIGNED': return 'bg-blue-100 text-blue-800'
            case 'IN_PROGRESS': return 'bg-purple-100 text-purple-800'
            case 'DELIVERED': return 'bg-green-100 text-green-800'
            case 'INSTALLED': return 'bg-emerald-100 text-emerald-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PENDING': return 'Pendiente'
            case 'ASSIGNED': return 'Asignado'
            case 'IN_PROGRESS': return 'En Progreso'
            case 'DELIVERED': return 'Entregado'
            case 'INSTALLED': return 'Instalado'
            default: return status
        }
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Orden #{invoice?.sequenceNumber}
                    </CardTitle>
                    <Badge className={getStatusColor(dispatch.status)}>
                        {getStatusLabel(dispatch.status)}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Cliente y Dirección */}
                <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Información de Entrega
                    </h3>
                    <div className="bg-blue-50 p-3 rounded-lg space-y-1 text-sm">
                        <p className="font-medium">{client?.name || invoice?.clientName}</p>
                        {client?.phone && <p>Tel: {client.phone}</p>}
                        {client?.address && (
                            <p className="text-gray-700">{client.address}</p>
                        )}
                        {!client?.address && (
                            <p className="text-orange-600 italic">Sin dirección registrada</p>
                        )}
                    </div>
                </div>

                {/* Items a instalar */}
                <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Items a Instalar/Entregar
                    </h3>
                    <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                        {invoice?.items?.map((item: { productName: string; quantity: number; price: number }) => (
                            <div key={item.productName} className="flex justify-between items-center text-sm">
                                <span>{item.productName}</span>
                                <span className="font-medium">x{item.quantity}</span>
                            </div>
                        ))}
                        <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                            <span>Total:</span>
                            <span>{formatCurrency(Number(invoice?.total))}</span>
                        </div>
                    </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-2 pt-2">
                    {dispatch.status === 'PENDING' && (
                        <Dialog open={open} onOpenChange={setOpen}>
                            <DialogTrigger asChild>
                                <Button className="flex-1">
                                    <Clock className="h-4 w-4 mr-2" />
                                    Iniciar Entrega
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Actualizar Estado de Entrega</DialogTitle>
                                    <DialogDescription>
                                        Marca el progreso de la entrega y agrega notas o fotos
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Notas</Label>
                                        <Textarea
                                            placeholder="Agrega notas sobre la entrega o instalación..."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            rows={3}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Fotos (opcional)</Label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                onChange={handlePhotoUpload}
                                                className="hidden"
                                                id="photo-upload"
                                                disabled={uploading}
                                            />
                                            <label htmlFor="photo-upload">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    disabled={uploading}
                                                    asChild
                                                >
                                                    <span className="cursor-pointer">
                                                        <Camera className="h-4 w-4 mr-2" />
                                                        {uploading ? "Subiendo..." : "Agregar Fotos"}
                                                    </span>
                                                </Button>
                                            </label>
                                            <span className="text-sm text-gray-500">
                                                {photos.length} foto{photos.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        {photos.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                {photos.map((photo, idx) => (
                                                    <div key={idx} className="relative aspect-video">
                                                        <Image
                                                            src={photo}
                                                            alt={`Foto ${idx + 1}`}
                                                            fill
                                                            className="object-cover rounded"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="sm"
                                                            className="absolute top-1 right-1"
                                                            onClick={() => {
                                                                setPhotos(photos.filter((_, i) => i !== idx))
                                                            }}
                                                        >
                                                            ×
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        {dispatch.status !== 'INSTALLED' && (
                                            <Button
                                                onClick={() => handleStatusUpdate('DELIVERED')}
                                                className="flex-1"
                                                variant="outline"
                                            >
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Marcar Entregado
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => handleStatusUpdate('INSTALLED')}
                                            className="flex-1"
                                        >
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Marcar Instalado
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                    {dispatch.status === 'ASSIGNED' || dispatch.status === 'IN_PROGRESS' && (
                        <Dialog open={open} onOpenChange={setOpen}>
                            <DialogTrigger asChild>
                                <Button className="flex-1">
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Actualizar Estado
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Completar Entrega/Instalación</DialogTitle>
                                    <DialogDescription>
                                        Confirma la entrega o instalación y agrega fotos de evidencia
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Notas de Instalación/Entrega</Label>
                                        <Textarea
                                            placeholder="Describe cualquier incidencia o detalle importante..."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            rows={3}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Fotos de Evidencia</Label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handlePhotoUpload}
                                            className="hidden"
                                            id="photo-upload-2"
                                            disabled={uploading}
                                        />
                                        <label htmlFor="photo-upload-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={uploading}
                                                asChild
                                            >
                                                <span className="cursor-pointer">
                                                    <Camera className="h-4 w-4 mr-2" />
                                                    {uploading ? "Subiendo..." : "Agregar Fotos"}
                                                </span>
                                            </Button>
                                        </label>
                                        {photos.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                {photos.map((photo, idx) => (
                                                    <div key={idx} className="relative aspect-video">
                                                        <Image
                                                            src={photo}
                                                            alt={`Foto ${idx + 1}`}
                                                            fill
                                                            className="object-cover rounded"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => handleStatusUpdate('DELIVERED')}
                                            className="flex-1"
                                            variant="outline"
                                        >
                                            Marcar Entregado
                                        </Button>
                                        <Button
                                            onClick={() => handleStatusUpdate('INSTALLED')}
                                            className="flex-1"
                                        >
                                            Marcar Instalado
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                    {(dispatch.status === 'DELIVERED' || dispatch.status === 'INSTALLED') && (
                        <div className="w-full text-center text-sm text-green-600 font-medium">
                            ✓ Completado el {format(new Date(dispatch.deliveredAt || dispatch.installedAt || ''), "dd/MM/yyyy", { locale: es })}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
