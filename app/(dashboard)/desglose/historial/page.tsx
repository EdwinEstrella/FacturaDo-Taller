"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { getWindowBreakdowns } from "@/actions/window-breakdown-actions"

interface FilterOptions {
    dateFrom: string
    dateTo: string
    clientName: string
    windowType: string
    minWindows: string
    maxWindows: string
}

interface WindowBreakdown {
    id: string
    windowType: string
    clientName: string | null
    technicianName: string | null
    createdByName: string | null
    totalWindows: number
    createdAt: string
    printedAt: string | null
    items: WindowBreakdownItem[]
}

interface WindowBreakdownItem {
    id: number
    ancho: number
    alto: number
    resCabRiel?: number
    resLateral?: number
    resJambas?: number
    resCabAlfDiv?: number
    resVAnchoDiv?: number
    resVAltura?: number
    notas?: string
}

function decimalToFraction(dec: number): string {
    const whole = Math.floor(dec)
    const fraction = dec - whole

    if (fraction === 0) return `${whole}`

    const fractions = [
        { value: 0.03125, denom: 32, num: 1 },
        { value: 0.0625, denom: 16, num: 1 },
        { value: 0.09375, denom: 16, num: 1.5 },
        { value: 0.125, denom: 8, num: 1 },
        { value: 0.1875, denom: 8, num: 1.5 },
        { value: 0.25, denom: 4, num: 1 },
        { value: 0.3125, denom: 16, num: 5 },
        { value: 0.375, denom: 8, num: 3 },
        { value: 0.4375, denom: 16, num: 7 },
        { value: 0.5, denom: 2, num: 1 },
        { value: 0.5625, denom: 16, num: 9 },
        { value: 0.625, denom: 8, num: 5 },
        { value: 0.6875, denom: 16, num: 11 },
        { value: 0.75, denom: 4, num: 3 },
        { value: 0.8125, denom: 16, num: 13 },
        { value: 0.875, denom: 8, num: 7 },
        { value: 0.9375, denom: 16, num: 15 },
    ]

    let bestMatch = fractions[0]
    let minDiff = Math.abs(fraction - bestMatch.value)

    for (const f of fractions) {
        const diff = Math.abs(fraction - f.value)
        if (diff < minDiff) {
            minDiff = diff
            bestMatch = f
        }
    }

    const numerator = Math.round(bestMatch.num)
    const denominator = bestMatch.denom

    const gcd = (a: number, b: number): number => {
        return b === 0 ? a : gcd(b, a % b)
    }

    const divisor = gcd(numerator, denominator)
    const simplifiedNum = numerator / divisor
    const simplifiedDenom = denominator / divisor

    if (whole === 0) return `${simplifiedNum}/${simplifiedDenom}`
    return `${whole} ${simplifiedNum}/${simplifiedDenom}`
}

export default function HistorialDesglosePage() {
    const [desgloses, setDesgloses] = useState<WindowBreakdown[]>([])
    const [filteredDesgloses, setFilteredDesgloses] = useState<WindowBreakdown[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [isClient, setIsClient] = useState<boolean>(false)
    const [selectedDesglose, setSelectedDesglose] = useState<WindowBreakdown | null>(null)
    const [dialogOpen, setDialogOpen] = useState<boolean>(false)

    const [filters, setFilters] = useState<FilterOptions>({
        dateFrom: "",
        dateTo: "",
        clientName: "",
        windowType: "",
        minWindows: "",
        maxWindows: ""
    })

    // Evitar error de hidratación
    useEffect(() => {
        setIsClient(true)
    }, [])

    const cargarDesgloses = async () => {
        setLoading(true)
        try {
            const data = await getWindowBreakdowns()
            setDesgloses(data as WindowBreakdown[])
            setFilteredDesgloses(data as WindowBreakdown[])
        } catch (error) {
            console.error("Error cargando desgloses:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isClient) {
            cargarDesgloses()
        }
    }, [isClient])

    const aplicarFiltros = useCallback(() => {
        let filtrados = [...desgloses]

        // Filtro por fecha desde
        if (filters.dateFrom) {
            filtrados = filtrados.filter(d => {
                const fecha = new Date(d.createdAt)
                const fechaDesde = new Date(filters.dateFrom)
                return fecha >= fechaDesde
            })
        }

        // Filtro por fecha hasta
        if (filters.dateTo) {
            filtrados = filtrados.filter(d => {
                const fecha = new Date(d.createdAt)
                const fechaHasta = new Date(filters.dateTo)
                fechaHasta.setHours(23, 59, 59)
                return fecha <= fechaHasta
            })
        }

        // Filtro por nombre del cliente
        if (filters.clientName) {
            filtrados = filtrados.filter(d =>
                d.clientName?.toLowerCase().includes(filters.clientName.toLowerCase())
            )
        }

        // Filtro por tipo de ventana
        if (filters.windowType) {
            filtrados = filtrados.filter(d => d.windowType === filters.windowType)
        }

        // Filtro por cantidad mínima de ventanas
        if (filters.minWindows) {
            filtrados = filtrados.filter(d => d.totalWindows >= parseInt(filters.minWindows))
        }

        // Filtro por cantidad máxima de ventanas
        if (filters.maxWindows) {
            filtrados = filtrados.filter(d => d.totalWindows <= parseInt(filters.maxWindows))
        }

        setFilteredDesgloses(filtrados)
    }, [filters, desgloses])

    useEffect(() => {
        aplicarFiltros()
    }, [aplicarFiltros])

    const limpiarFiltros = () => {
        setFilters({
            dateFrom: "",
            dateTo: "",
            clientName: "",
            windowType: "",
            minWindows: "",
            maxWindows: ""
        })
    }

    const verDetalles = (desglose: WindowBreakdown) => {
        setSelectedDesglose(desglose)
        setDialogOpen(true)
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Historial de Desgloses</h1>
                <p className="text-muted-foreground">
                    Consulta y filtra el historial completo de desgloses de ventanas
                </p>
            </div>

            {/* Filtros */}
            <Card>
                <CardHeader>
                    <CardTitle>Filtros de Búsqueda</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="dateFrom">Fecha Desde</Label>
                            <Input
                                id="dateFrom"
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dateTo">Fecha Hasta</Label>
                            <Input
                                id="dateTo"
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="clientName">Nombre del Cliente</Label>
                            <Input
                                id="clientName"
                                type="text"
                                placeholder="Buscar por nombre..."
                                value={filters.clientName}
                                onChange={(e) => setFilters({ ...filters, clientName: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="windowType">Tipo de Ventana</Label>
                            <select
                                id="windowType"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={filters.windowType}
                                onChange={(e) => setFilters({ ...filters, windowType: e.target.value })}
                            >
                                <option value="">Todos los tipos</option>
                                <option value="P65">Ventana P65</option>
                                <option value="TRADICIONAL">Ventana Tradicional</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="minWindows">Mínimo de Ventanas</Label>
                            <Input
                                id="minWindows"
                                type="number"
                                placeholder="Ej: 5"
                                value={filters.minWindows}
                                onChange={(e) => setFilters({ ...filters, minWindows: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="maxWindows">Máximo de Ventanas</Label>
                            <Input
                                id="maxWindows"
                                type="number"
                                placeholder="Ej: 20"
                                value={filters.maxWindows}
                                onChange={(e) => setFilters({ ...filters, maxWindows: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <Button onClick={limpiarFiltros} variant="outline">
                            Limpiar Filtros
                        </Button>
                        <Button onClick={cargarDesgloses} variant="outline">
                            Recargar
                        </Button>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                        Mostrando {filteredDesgloses.length} de {desgloses.length} desgloses
                    </div>
                </CardContent>
            </Card>

            {/* Tabla de resultados */}
            <Card>
                <CardHeader>
                    <CardTitle>Resultados</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">Cargando historial...</p>
                        </div>
                    ) : filteredDesgloses.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">No se encontraron desgloses con los filtros aplicados</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Ventanas</TableHead>
                                        <TableHead>Técnico</TableHead>
                                        <TableHead>Creado por</TableHead>
                                        <TableHead>Impreso</TableHead>
                                        <TableHead>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredDesgloses.map((desglose) => (
                                        <TableRow key={desglose.id}>
                                            <TableCell>
                                                {isClient && new Date(desglose.createdAt).toLocaleDateString('es-DO')}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {desglose.clientName || "Sin cliente"}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    desglose.windowType === 'P65'
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-green-100 text-green-800'
                                                }`}>
                                                    {desglose.windowType === 'P65' ? 'P65' : 'Tradicional'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center font-semibold">
                                                {desglose.totalWindows}
                                            </TableCell>
                                            <TableCell>
                                                {desglose.technicianName || "No especificado"}
                                            </TableCell>
                                            <TableCell>
                                                {desglose.createdByName || "Sistema"}
                                            </TableCell>
                                            <TableCell>
                                                {desglose.printedAt ? (
                                                    <span className="text-green-600 text-xs">
                                                        ✓ {isClient && new Date(desglose.printedAt).toLocaleDateString('es-DO')}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">Pendiente</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => verDetalles(desglose)}
                                                >
                                                    Ver Detalles
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dialog para ver detalles */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detalles del Desglose</DialogTitle>
                        <DialogDescription>
                            {selectedDesglose?.clientName && `Cliente: ${selectedDesglose.clientName}`}
                            {selectedDesglose?.technicianName && ` | Técnico: ${selectedDesglose.technicianName}`}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedDesglose && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="font-semibold">Tipo:</span>{' '}
                                    {selectedDesglose.windowType === 'P65' ? 'P65' : 'Tradicional'}
                                </div>
                                <div>
                                    <span className="font-semibold">Total Ventanas:</span>{' '}
                                    {selectedDesglose.totalWindows}
                                </div>
                                <div>
                                    <span className="font-semibold">Fecha:</span>{' '}
                                    {new Date(selectedDesglose.createdAt).toLocaleDateString('es-DO')}
                                </div>
                                <div>
                                    <span className="font-semibold">Estado:</span>{' '}
                                    {selectedDesglose.printedAt ? (
                                        <span className="text-green-600">Impreso</span>
                                    ) : (
                                        <span className="text-yellow-600">Pendiente</span>
                                    )}
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h3 className="font-semibold mb-3">Ventanas:</h3>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {selectedDesglose.items.map((item, idx) => (
                                        <div key={idx} className="p-3 bg-muted rounded-lg">
                                            <div className="font-semibold text-sm mb-2">
                                                #{idx + 1}: {decimalToFraction(item.ancho)} x {decimalToFraction(item.alto)}
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                {item.resCabRiel && (
                                                    <div><span className="font-medium">Cab/Riel:</span> {decimalToFraction(item.resCabRiel)}</div>
                                                )}
                                                {item.resLateral && (
                                                    <div><span className="font-medium">Lateral:</span> {decimalToFraction(item.resLateral)}</div>
                                                )}
                                                {item.resJambas && (
                                                    <div><span className="font-medium">Jambas:</span> {decimalToFraction(item.resJambas)}</div>
                                                )}
                                                {item.resCabAlfDiv && (
                                                    <div><span className="font-medium">Cab/Alf Div:</span> {decimalToFraction(item.resCabAlfDiv)}</div>
                                                )}
                                                {item.resVAnchoDiv && (
                                                    <div><span className="font-medium">V. Ancho Div:</span> {decimalToFraction(item.resVAnchoDiv)}</div>
                                                )}
                                                {item.resVAltura && (
                                                    <div><span className="font-medium">V. Altura:</span> {decimalToFraction(item.resVAltura)}</div>
                                                )}
                                                {item.notas && (
                                                    <div className="col-span-2 mt-2 pt-2 border-t">
                                                        <span className="font-medium">Notas:</span> {item.notas}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
