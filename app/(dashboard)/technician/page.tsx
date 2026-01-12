"use client"

import { useState, useEffect } from "react"
import { getTechnicianDispatches, updateDispatchStatus } from "@/actions/dispatch-actions"
import { getCurrentUser } from "@/actions/auth-actions"
import { DispatchCard } from "@/components/modules/technicians/dispatch-card"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, CheckCircle } from "lucide-react"
import TetrisLoading from "@/components/ui/tetris-loader"

interface DispatchWithInvoice {
    id: string
    status: string
    invoice: {
        id: string
        sequenceNumber: number
        client: {
            name: string
            address: string | null
            phone: string | null
        } | null
        items: Array<{
            productName: string
            quantity: number
        }>
    } | null
    notes?: string | null
}

export default function TechnicianPage() {
    const [dispatches, setDispatches] = useState<DispatchWithInvoice[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const user = await getCurrentUser()
            if (!user) return

            const data = await getTechnicianDispatches(user.id)
            setDispatches(data)
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateStatus = async (dispatchId: string, status: string, notes: string, photos: string[]) => {
        await updateDispatchStatus(dispatchId, status, notes, photos)
        await loadData()
    }

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center min-h-[50vh]">
                <TetrisLoading size="md" speed="normal" loadingText="Cargando asignaciones..." />
            </div>
        )
    }

    const pendingCount = dispatches.filter((d) => d.status === 'PENDING').length
    const inProgressCount = dispatches.filter((d) => d.status === 'IN_PROGRESS').length
    const completedCount = dispatches.filter((d) => d.status === 'DELIVERED' || d.status === 'INSTALLED').length

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Módulo de Técnico</h2>
                    <p className="text-muted-foreground">
                        Gestiona tus asignaciones de entrega e instalación
                    </p>
                </div>
            </div>

            {/* Resumen */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Pendientes</p>
                                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                            </div>
                            <Clock className="h-8 w-8 text-yellow-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">En Progreso</p>
                                <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
                            </div>
                            <Clock className="h-8 w-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Completados</p>
                                <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Lista de Despachos */}
            <div className="space-y-4">
                {dispatches.length === 0 ? (
                    <Card>
                        <CardContent className="p-12 text-center text-muted-foreground">
                            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No tienes asignaciones pendientes</p>
                        </CardContent>
                    </Card>
                ) : (
                    dispatches.map((dispatch) => (
                        <DispatchCard
                            key={dispatch.id}
                            dispatch={dispatch}
                            onUpdateStatus={handleUpdateStatus}
                        />
                    ))
                )}
            </div>
        </div>
    )
}
