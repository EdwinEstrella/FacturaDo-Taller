"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { saveWindowBreakdown, getWindowBreakdowns, markAsPrinted, getPendingBreakdowns, deletePendingBreakdowns, createInitialBreakdown, updateBreakdownItems, type WindowBreakdownItem } from "@/actions/window-breakdown-actions"

interface CalculationResults {
    id: number
    ancho: number
    alto: number
    resCabRiel: number
    resLateral: number
    resJambas: number
    resCabAlfDiv: number
    resVAnchoDiv: number
    resVAltura: number
}

interface ImportedWindowBreakdownItem {
    id: number
    ancho: number
    alto: number
    resCabRiel?: number
    resLateral?: number
    resJambas?: number
    resCabAlfDiv?: number
    resVAnchoDiv?: number
    resVAltura?: number
}

interface WindowBreakdown {
    id: string
    clientName: string | null
    technicianName: string | null
    totalWindows: number
    createdAt: string
    printedAt: string | null
    items: ImportedWindowBreakdownItem[]
}

function decimalToFraction(dec: number): string {
    // Redondear a 4 decimales para evitar problemas de precisión de JavaScript
    const rounded = Math.round(dec * 10000) / 10000
    const whole = Math.floor(rounded)
    const fraction = rounded - whole

    // Si no hay parte fraccionaria, devolver solo el entero
    if (fraction === 0) return `${whole}`

    // Fracciones comunes en construcción
    const fractions = [
        { value: 0.03125, denom: 32, num: 1 },    // 1/32
        { value: 0.0625, denom: 16, num: 1 },     // 1/16
        { value: 0.09375, denom: 16, num: 1.5 },  // 3/32 (aprox)
        { value: 0.125, denom: 8, num: 1 },       // 1/8
        { value: 0.1875, denom: 8, num: 1.5 },    // 3/16 (aprox)
        { value: 0.25, denom: 4, num: 1 },        // 1/4
        { value: 0.3125, denom: 16, num: 5 },     // 5/16
        { value: 0.375, denom: 8, num: 3 },       // 3/8
        { value: 0.4375, denom: 16, num: 7 },     // 7/16
        { value: 0.5, denom: 2, num: 1 },         // 1/2
        { value: 0.5625, denom: 16, num: 9 },     // 9/16
        { value: 0.625, denom: 8, num: 5 },       // 5/8
        { value: 0.6875, denom: 16, num: 11 },    // 11/16
        { value: 0.75, denom: 4, num: 3 },        // 3/4
        { value: 0.8125, denom: 16, num: 13 },    // 13/16
        { value: 0.875, denom: 8, num: 7 },       // 7/8
        { value: 0.9375, denom: 16, num: 15 },    // 15/16
    ]

    // Buscar la coincidencia exacta más cercana
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

    // Simplificar la fracción
    const gcd = (a: number, b: number): number => {
        return b === 0 ? a : gcd(b, a % b)
    }

    const divisor = gcd(numerator, denominator)
    const simplifiedNum = numerator / divisor
    const simplifiedDenom = denominator / divisor

    if (whole === 0) return `${simplifiedNum}/${simplifiedDenom}`
    return `${whole} ${simplifiedNum}/${simplifiedDenom}`
}

export default function VentanaTradicionalPage() {
    const [alto, setAlto] = useState<string>("")
    const [ancho, setAncho] = useState<string>("")
    const [resultados, setResultados] = useState<CalculationResults[]>([])
    const [contador, setContador] = useState<number>(0)
    const [mostrarImpresion, setMostrarImpresion] = useState<boolean>(false)
    const [filaEditando, setFilaEditando] = useState<number | null>(null)
    const [nombreCliente, setNombreCliente] = useState<string>("")
    const [nombreTecnico, setNombreTecnico] = useState<string>("")
    const [isClient, setIsClient] = useState<boolean>(false)
    const [datosGuardados, setDatosGuardados] = useState<boolean>(false)
    const [guardando, setGuardando] = useState<boolean>(false)
    const [historial, setHistorial] = useState<WindowBreakdown[]>([])
    const [mostrarHistorial, setMostrarHistorial] = useState<boolean>(false)
    const [mostrarReinicioDialog, setMostrarReinicioDialog] = useState<boolean>(false)
    const [breakdownsPendientes, setBreakdownsPendientes] = useState<WindowBreakdown[]>([])
    const [currentBreakdownId, setCurrentBreakdownId] = useState<string | null>(null)

    // Evitar error de hidratación - inicializar isClient
    useState(() => {
        setIsClient(true)
    })

    const cargarHistorial = async () => {
        const breakdowns = await getWindowBreakdowns("TRADICIONAL")
        setHistorial(breakdowns)
    }

    useEffect(() => {
        if (isClient) {
            cargarHistorial()
        }
    }, [isClient])

    const guardarDatosCliente = async () => {
        if (!nombreCliente) {
            alert("Por favor ingresa el nombre del cliente")
            setTimeout(() => {
                const inputCliente = document.getElementById("cliente") as HTMLInputElement
                inputCliente?.focus()
            }, 100)
            return
        }

        if (!nombreTecnico) {
            alert("Por favor ingresa el nombre del técnico")
            setTimeout(() => {
                const inputTecnico = document.getElementById("tecnico") as HTMLInputElement
                inputTecnico?.focus()
            }, 100)
            return
        }

        setGuardando(true)

        try {
            // Primero verificar si hay breakdowns pendientes
            const pendings = await getPendingBreakdowns(nombreCliente, nombreTecnico, "TRADICIONAL")

            if (pendings.length > 0) {
                // Mostrar diálogo de pendientes
                setBreakdownsPendientes(pendings)
                setMostrarReinicioDialog(true)
                setGuardando(false)
                return
            }

            // Si no hay pendientes, crear breakdown inicial en la base de datos
            const result = await createInitialBreakdown("TRADICIONAL", nombreCliente, nombreTecnico)

            if (result.success) {
                setCurrentBreakdownId(result.id || null)
                setDatosGuardados(true)

                // Enfocar en el campo de ancho
                setTimeout(() => {
                    const inputAncho = document.getElementById("ancho") as HTMLInputElement
                    inputAncho?.focus()
                }, 100)
            } else {
                alert("Error al guardar: " + result.error)
            }
        } catch (error) {
            console.error("Error al guardar datos del cliente:", error)
            alert("Error al guardar los datos del cliente")
        } finally {
            setGuardando(false)
        }
    }

    const parseFraction = (value: string): number => {
        if (!value.trim()) return 0

        // Si es un número decimal directo
        if (!value.includes('/') && !value.includes(' ')) {
            const num = parseFloat(value)
            return isNaN(num) ? 0 : num
        }

        // Formato: "14 1/4" o "7 5/8"
        const parts = value.trim().split(' ')
        let total = 0

        for (const part of parts) {
            if (part.includes('/')) {
                // Es una fracción como "1/4"
                const [numerator, denominator] = part.split('/').map(p => parseInt(p.trim()))
                if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                    total += numerator / denominator
                }
            } else {
                // Es un número entero
                const num = parseInt(part.trim())
                if (!isNaN(num)) {
                    total += num
                }
            }
        }

        return total
    }

    const calcular = async () => {
        // Verificar que haya datos del cliente y técnico antes de agregar ventanas
        if (!nombreCliente) {
            alert("Por favor ingresa el nombre del cliente antes de agregar ventanas")
            setTimeout(() => {
                const inputCliente = document.getElementById("cliente") as HTMLInputElement
                inputCliente?.focus()
            }, 100)
            return
        }

        if (!nombreTecnico) {
            alert("Por favor ingresa el nombre del técnico antes de agregar ventanas")
            setTimeout(() => {
                const inputTecnico = document.getElementById("tecnico") as HTMLInputElement
                inputTecnico?.focus()
            }, 100)
            return
        }

        const altoValue = parseFraction(alto)
        const anchoValue = parseFraction(ancho)

        if (altoValue > 0 && anchoValue > 0) {
            // Des. Riel: 1/4 (0.25) al ancho
            const desRiel = 0.25
            const resRiel = anchoValue - desRiel

            // Des. Lateral: 1/2 (0.5) al alto
            const desLateral = 0.5
            const resLateral = altoValue - desLateral

            // Des. Jamba: 1 al alto
            const desJamba = 1
            const resJambas = altoValue - desJamba

            // Cab/alf: 1/2 (0.5) al ancho ORIGINAL, dividido entre 2
            const desCabAlf = 0.5
            const resCabAlf = anchoValue - desCabAlf
            const resCabAlfDiv = resCabAlf / 2

            // Des. V. Ancho: 4 al ancho ORIGINAL, dividido entre 2
            const desVAncho = 4
            const resVAncho = anchoValue - desVAncho
            const resVAnchoDiv = resVAncho / 2

            // V. Alto: 3 7/8 (3.875) al alto
            const desVAlto = 3.875
            const resVAlto = altoValue - desVAlto

            if (filaEditando !== null) {
                // Actualizar fila existente
                const nuevosResultados = resultados.map(r => {
                    if (r.id === filaEditando) {
                        return {
                            ...r,
                            ancho: anchoValue,
                            alto: altoValue,
                            resCabRiel: resRiel,
                            resLateral,
                            resJambas,
                            resCabAlfDiv,
                            resVAnchoDiv,
                            resVAltura: resVAlto
                        }
                    }
                    return r
                })
                setResultados(nuevosResultados)
                setFilaEditando(null)
            } else {
                // Crear nueva fila
                const nuevoResultado: CalculationResults = {
                    id: contador + 1,
                    ancho: anchoValue,
                    alto: altoValue,
                    resCabRiel: resRiel,
                    resLateral,
                    resJambas,
                    resCabAlfDiv,
                    resVAnchoDiv,
                    resVAltura: resVAlto
                }
                setResultados([...resultados, nuevoResultado])
                setContador(contador + 1)
            }

            // Limpiar inputs para siguiente cálculo
            setAlto("")
            setAncho("")

            // Actualizar breakdown en la base de datos
            if (currentBreakdownId) {
                const items: WindowBreakdownItem[] = resultados.map(r => ({
                    id: r.id,
                    ancho: r.ancho,
                    alto: r.alto,
                    resCabRiel: r.resCabRiel,
                    resLateral: r.resLateral,
                    resJambas: r.resJambas,
                    resCabAlfDiv: r.resCabAlfDiv,
                    resVAnchoDiv: r.resVAnchoDiv,
                    resVAltura: r.resVAltura
                }))

                // Agregar la nueva ventana
                if (filaEditando === null) {
                    items.push({
                        id: contador + 1,
                        ancho: anchoValue,
                        alto: altoValue,
                        resCabRiel: resRiel,
                        resLateral,
                        resJambas,
                        resCabAlfDiv,
                        resVAnchoDiv,
                        resVAltura: resVAlto
                    })
                }

                await updateBreakdownItems(currentBreakdownId, items)
            }

            // Enfocar en el input de ancho
            setTimeout(() => {
                const inputAncho = document.getElementById("ancho") as HTMLInputElement
                inputAncho?.focus()
            }, 100)
        }
    }

    const editarFila = (id: number) => {
        const fila = resultados.find(r => r.id === id)
        if (fila) {
            setAncho(decimalToFraction(fila.ancho))
            setAlto(decimalToFraction(fila.alto))
            setFilaEditando(id)
        }
    }

    const eliminarFila = async (id: number) => {
        const nuevosResultados = resultados.filter(r => r.id !== id)
        setResultados(nuevosResultados)
        if (filaEditando === id) {
            setFilaEditando(null)
            setAlto("")
            setAncho("")
        }

        // Actualizar breakdown en la base de datos
        if (currentBreakdownId) {
            const items: WindowBreakdownItem[] = nuevosResultados.map(r => ({
                id: r.id,
                ancho: r.ancho,
                alto: r.alto,
                resCabRiel: r.resCabRiel,
                resLateral: r.resLateral,
                resJambas: r.resJambas,
                resCabAlfDiv: r.resCabAlfDiv,
                resVAnchoDiv: r.resVAnchoDiv,
                resVAltura: r.resVAltura
            }))

            await updateBreakdownItems(currentBreakdownId, items)
        }
    }

    const cancelarEdicion = () => {
        setFilaEditando(null)
        setAlto("")
        setAncho("")
    }

    const limpiar = async () => {
        // Check for pending breakdowns in database
        if (nombreCliente && nombreTecnico) {
            const pendings = await getPendingBreakdowns(nombreCliente, nombreTecnico, "TRADICIONAL")

            if (pendings.length > 0) {
                // Show dialog with pending breakdowns
                setBreakdownsPendientes(pendings)
                setMostrarReinicioDialog(true)
                return
            }
        }

        // If no pending breakdowns, just clear the form
        setAlto("")
        setAncho("")
        setResultados([])
        setContador(0)
        setDatosGuardados(false)
        setNombreCliente("")
        setNombreTecnico("")
    }

    const handleSeguirEditando = () => {
        // Load the most recent pending breakdown
        if (breakdownsPendientes.length > 0) {
            const mostRecent = breakdownsPendientes[0]

            // Load items from the breakdown
            setResultados(mostRecent.items.map((item: ImportedWindowBreakdownItem) => ({
                id: item.id,
                ancho: item.ancho,
                alto: item.alto,
                resCabRiel: item.resCabRiel || 0,
                resLateral: item.resLateral || 0,
                resJambas: item.resJambas || 0,
                resCabAlfDiv: item.resCabAlfDiv || 0,
                resVAnchoDiv: item.resVAnchoDiv || 0,
                resVAltura: item.resVAltura || 0
            })))

            setContador(mostRecent.items.length)
            setDatosGuardados(true)
            setCurrentBreakdownId(mostRecent.id)
            setMostrarReinicioDialog(false)
            setBreakdownsPendientes([])
        }
    }

    const handleEliminarPendientes = async () => {
        // Delete all pending breakdowns
        if (nombreCliente && nombreTecnico) {
            await deletePendingBreakdowns(nombreCliente, nombreTecnico, "TRADICIONAL")

            // Reload historial
            await cargarHistorial()

            // Clear form
            setAlto("")
            setAncho("")
            setResultados([])
            setContador(0)
            setDatosGuardados(false)
            setNombreCliente("")
            setNombreTecnico("")
            setMostrarReinicioDialog(false)
            setBreakdownsPendientes([])
        }
    }

    const handleGuardarEImprimir = async () => {
        if (!nombreCliente || !nombreTecnico) {
            alert("Por favor completa todos los campos requeridos")
            return
        }

        if (resultados.length === 0) {
            alert("Por favor agrega al menos una ventana antes de guardar")
            return
        }

        setGuardando(true)

        try {
            let breakdownId = currentBreakdownId

            // Si no hay un breakdown actual, crear uno nuevo
            if (!breakdownId) {
                const items: WindowBreakdownItem[] = resultados.map(r => ({
                    id: r.id,
                    ancho: r.ancho,
                    alto: r.alto,
                    resCabRiel: r.resCabRiel,
                    resLateral: r.resLateral,
                    resJambas: r.resJambas,
                    resCabAlfDiv: r.resCabAlfDiv,
                    resVAnchoDiv: r.resVAnchoDiv,
                    resVAltura: r.resVAltura
                }))

                const result = await saveWindowBreakdown({
                    windowType: "TRADICIONAL",
                    clientName: nombreCliente,
                    technicianName: nombreTecnico,
                    items
                })

                if (!result.success) {
                    alert("Error al guardar: " + result.error)
                    return
                }

                breakdownId = result.id!
            } else {
                // Actualizar el breakdown existente
                const items: WindowBreakdownItem[] = resultados.map(r => ({
                    id: r.id,
                    ancho: r.ancho,
                    alto: r.alto,
                    resCabRiel: r.resCabRiel,
                    resLateral: r.resLateral,
                    resJambas: r.resJambas,
                    resCabAlfDiv: r.resCabAlfDiv,
                    resVAnchoDiv: r.resVAnchoDiv,
                    resVAltura: r.resVAltura
                }))

                await updateBreakdownItems(breakdownId, items)
            }

            // Marcar como impreso
            await markAsPrinted(breakdownId)

            // Recargar historial
            await cargarHistorial()

            // Mostrar impresión
            setMostrarImpresion(true)

            // Mostrar mensaje de éxito
            alert("Desglose guardado exitosamente en el historial")
        } catch (error) {
            console.error("Error al guardar e imprimir:", error)
            alert("Error al guardar el desglose")
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Ventana Tradicional</h1>
                {isClient && datosGuardados && (
                    <p className="text-muted-foreground mt-1">
                        Cliente: <span className="font-semibold text-foreground">{nombreCliente}</span> |
                        Técnico: <span className="font-semibold text-foreground">{nombreTecnico}</span>
                    </p>
                )}
                {isClient && !datosGuardados && (
                    <p className="text-muted-foreground">
                        Calculadora para ventanas tradicionales
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Inputs a la izquierda */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {filaEditando !== null ? `Editando Fila #${filaEditando}` : "Medidas de la Ventana"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-4">
                            {/* Información del cliente - SIEMPRE visible */}
                            {isClient && !datosGuardados && (
                                <div className="border-b border-dashed pb-4">
                                    <p className="text-sm font-semibold mb-3">Información del Cliente (Presiona Enter para guardar)</p>
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="cliente">Nombre del Cliente *</Label>
                                            <Input
                                                id="cliente"
                                                type="text"
                                                placeholder="Nombre del cliente (requerido) - Presiona Enter"
                                                value={nombreCliente}
                                                onChange={(e) => setNombreCliente(e.target.value)}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        const inputTecnico = document.getElementById("tecnico") as HTMLInputElement
                                                        inputTecnico?.focus()
                                                    }
                                                }}
                                                className={!nombreCliente ? "border-red-300" : ""}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="tecnico">Nombre del Técnico *</Label>
                                            <Input
                                                id="tecnico"
                                                type="text"
                                                placeholder="Nombre del técnico (requerido) - Presiona Enter para guardar"
                                                value={nombreTecnico}
                                                onChange={(e) => setNombreTecnico(e.target.value)}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        guardarDatosCliente()
                                                    }
                                                }}
                                                className={!nombreTecnico ? "border-red-300" : ""}
                                            />
                                        </div>
                                        <Button
                                            onClick={guardarDatosCliente}
                                            disabled={!nombreCliente || !nombreTecnico || guardando}
                                            className="w-full"
                                        >
                                            {guardando ? "Guardando..." : "Guardar y Comenzar"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Mostrar datos guardados con opción de editar */}
                            {isClient && datosGuardados && (
                                <div className="border-b border-dashed pb-4">
                                    <p className="text-sm font-semibold mb-3">Información del Cliente</p>
                                    <div className="space-y-2 text-sm">
                                        <p><span className="font-medium">Cliente:</span> {nombreCliente}</p>
                                        <p><span className="font-medium">Técnico:</span> {nombreTecnico}</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setDatosGuardados(false)}
                                        >
                                            Modificar Datos
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Medidas de la ventana */}
                            {isClient && datosGuardados && (
                                <>
                                    <div className="border-t border-dashed pt-4">
                                        <p className="text-sm font-semibold mb-3">Medidas de la Ventana</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="ancho">Ancho</Label>
                                        <Input
                                            id="ancho"
                                            type="text"
                                            placeholder="Ej: 14 1/4 o 14.25"
                                            value={ancho}
                                            onChange={(e) => setAncho(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    calcular()
                                                }
                                            }}
                                            className={filaEditando !== null ? "border-yellow-500 bg-yellow-50" : ""}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="alto">Alto</Label>
                                        <Input
                                            id="alto"
                                            type="text"
                                            placeholder="Ej: 7 5/8 o 7.625"
                                            value={alto}
                                            onChange={(e) => setAlto(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    calcular()
                                                }
                                            }}
                                            className={filaEditando !== null ? "border-yellow-500 bg-yellow-50" : ""}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {isClient && datosGuardados && (
                                <Button
                                    onClick={calcular}
                                    disabled={!alto || !ancho}
                                    className="flex-1"
                                    variant={filaEditando !== null ? "default" : "default"}
                                >
                                    {filaEditando !== null ? "Actualizar (Enter)" : "Calcular (Enter)"}
                                </Button>
                            )}
                            {filaEditando !== null ? (
                                <Button variant="outline" onClick={cancelarEdicion}>
                                    Cancelar
                                </Button>
                            ) : resultados.length > 0 ? (
                                <Button variant="outline" onClick={limpiar}>
                                    Reiniciar
                                </Button>
                            ) : null}
                        </div>

                        <div className="text-sm text-muted-foreground">
                            <p className="font-medium mb-2">Instrucciones:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>1. Ingresa el nombre del cliente y presiona Enter</li>
                                <li>2. Ingresa el nombre del técnico y presiona Enter (o clic en Guardar)</li>
                                <li>3. Ingresa medidas en fracciones (ej: 14 1/4) o decimales (ej: 14.25)</li>
                                <li>4. Presiona Enter o click en Calcular para agregar ventana</li>
                                <li>5. Haz click en cualquier fila para editarla</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                {/* Resultados a la derecha */}
                {resultados.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Resultados de Cálculos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-16">No.</TableHead>
                                            <TableHead className="bg-blue-200">Ancho</TableHead>
                                            <TableHead className="bg-green-200">Alto</TableHead>
                                            <TableHead>Cab/Riel</TableHead>
                                            <TableHead>Lateral</TableHead>
                                            <TableHead>Jambas</TableHead>
                                            <TableHead>Cab/Alf</TableHead>
                                            <TableHead>V. Ancho</TableHead>
                                            <TableHead>V. Altura</TableHead>
                                            <TableHead className="w-24">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {resultados.map((resultado) => (
                                            <TableRow
                                                key={resultado.id}
                                                className={`cursor-pointer transition-colors ${
                                                    filaEditando === resultado.id ? 'bg-yellow-100' : 'hover:bg-muted'
                                                }`}
                                                onClick={() => editarFila(resultado.id)}
                                            >
                                                <TableCell className="font-medium">{resultado.id}</TableCell>
                                                <TableCell className="font-semibold bg-blue-100">{decimalToFraction(resultado.ancho)}</TableCell>
                                                <TableCell className="font-semibold bg-green-100">{decimalToFraction(resultado.alto)}</TableCell>
                                                <TableCell className="text-xs">{decimalToFraction(resultado.resCabRiel)}</TableCell>
                                                <TableCell className="text-xs">{decimalToFraction(resultado.resLateral)}</TableCell>
                                                <TableCell className="text-xs">{decimalToFraction(resultado.resJambas)}</TableCell>
                                                <TableCell className="text-xs">{decimalToFraction(resultado.resCabAlfDiv)}</TableCell>
                                                <TableCell className="text-xs">{decimalToFraction(resultado.resVAnchoDiv)}</TableCell>
                                                <TableCell className="text-xs">{decimalToFraction(resultado.resVAltura)}</TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            eliminarFila(resultado.id)
                                                        }}
                                                    >
                                                        ×
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="mt-4 flex gap-2">
                                <Button
                                    onClick={handleGuardarEImprimir}
                                    disabled={guardando || !nombreCliente}
                                    className="flex-1"
                                >
                                    {guardando ? "Guardando..." : "Guardar e Imprimir"}
                                </Button>
                                <Button variant="outline" onClick={limpiar}>
                                    Limpiar
                                </Button>
                            </div>

                            {historial.length > 0 && (
                                <div className="mt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setMostrarHistorial(!mostrarHistorial)}
                                        className="w-full"
                                    >
                                        {mostrarHistorial ? "Ocultar" : "Ver"} Historial ({historial.length})
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Previsualización de impresión */}
            {mostrarImpresion && resultados.length > 0 && (
                <>
                    <style jsx global>{`
                        @media print {
                            body * {
                                visibility: hidden;
                            }
                            #printable-area-tradicional, #printable-area-tradicional * {
                                visibility: visible;
                            }
                            #printable-area-tradicional {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 100%;
                            }
                            @page {
                                margin: 0;
                                size: 80mm auto;
                            }
                        }
                    `}</style>

                    {/* Contenido de impresión térmica */}
                    <div id="printable-area-tradicional" className="font-mono text-sm w-[80mm] p-2 bg-white text-black mx-auto">
                        {/* Header */}
                        <div className="text-center mb-3">
                            <h1 className="font-bold text-lg uppercase">FacturaDO</h1>
                            <p className="text-xs">Ventana Tradicional</p>
                        </div>

                        <div className="border-b border-dashed border-black mb-2"></div>

                        {/* Información del pedido */}
                        <div className="mb-2 text-xs">
                            {nombreCliente && (
                                <p><strong>Cliente:</strong> {nombreCliente}</p>
                            )}
                            {nombreTecnico && (
                                <p><strong>Técnico:</strong> {nombreTecnico}</p>
                            )}
                            <p><strong>Digitado:</strong> {new Date().toLocaleDateString('es-DO')}</p>
                        </div>

                        <div className="border-b border-dashed border-black mb-2"></div>

                        <div className="border-b border-dashed border-black mb-2"></div>

                        {/* Tabla de resultados */}
                        <table className="w-full mb-2 text-xs">
                            <thead>
                                <tr className="border-b border-black">
                                    <th className="text-left py-1 w-6">Fab</th>
                                    <th className="text-center py-1 w-8">No</th>
                                    <th className="text-center py-1 w-12 bg-blue-100">Ancho</th>
                                    <th className="text-center py-1 w-12 bg-green-100">Alto</th>
                                    <th className="text-center py-1">Cab/R</th>
                                    <th className="text-center py-1">Lat</th>
                                    <th className="text-center py-1">Jam</th>
                                    <th className="text-center py-1">C/A</th>
                                    <th className="text-center py-1">V.A</th>
                                    <th className="text-center py-1">V.Al</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resultados.map((resultado) => (
                                    <tr key={resultado.id} className="border-b border-dashed border-gray-300">
                                        <td className="py-1 text-center">
                                            <input type="checkbox" className="w-3 h-3" />
                                        </td>
                                        <td className="py-1 text-center">{resultado.id}</td>
                                        <td className="py-1 text-center bg-blue-50">{decimalToFraction(resultado.ancho)}</td>
                                        <td className="py-1 text-center bg-green-50">{decimalToFraction(resultado.alto)}</td>
                                        <td className="py-1 text-center">{decimalToFraction(resultado.resCabRiel)}</td>
                                        <td className="py-1 text-center">{decimalToFraction(resultado.resLateral)}</td>
                                        <td className="py-1 text-center">{decimalToFraction(resultado.resJambas)}</td>
                                        <td className="py-1 text-center">{decimalToFraction(resultado.resCabAlfDiv)}</td>
                                        <td className="py-1 text-center">{decimalToFraction(resultado.resVAnchoDiv)}</td>
                                        <td className="py-1 text-center">{decimalToFraction(resultado.resVAltura)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="border-b border-dashed border-black mb-2"></div>

                        {/* Resumen */}
                        <div className="text-xs">
                            <p className="font-bold">Total Ventanas: {resultados.length}</p>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-dashed border-black mt-3 pt-2 text-center">
                            <p className="text-[10px] italic">Generado por FacturaDO - Desglose Ventana Tradicional</p>
                        </div>
                    </div>
                </>
            )}

            {/* Historial de desgloses */}
            {mostrarHistorial && historial.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Historial de Desgloses Guardados</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {historial.map((breakdown) => (
                                <div key={breakdown.id} className="border rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-semibold">{breakdown.clientName || "Sin cliente"}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {breakdown.technicianName && `Técnico: ${breakdown.technicianName} | `}
                                                {new Date(breakdown.createdAt).toLocaleDateString('es-DO')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">
                                                {breakdown.totalWindows} ventanas
                                            </p>
                                            {breakdown.printedAt ? (
                                                <p className="text-xs text-green-600">
                                                    Impreso: {new Date(breakdown.printedAt).toLocaleDateString('es-DO')}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-yellow-600 font-medium">
                                                    Pendiente de imprimir
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-xs">
                                        <p className="font-medium mb-1">Ventanas:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {breakdown.items.slice(0, 5).map((item: ImportedWindowBreakdownItem, idx: number) => (
                                                <span key={idx} className="bg-muted px-2 py-1 rounded">
                                                    #{item.id}: {decimalToFraction(item.ancho)} x {decimalToFraction(item.alto)}
                                                </span>
                                            ))}
                                            {breakdown.items.length > 5 && (
                                                <span className="text-muted-foreground">
                                                    +{breakdown.items.length - 5} más
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {!breakdown.printedAt && (
                                        <div className="mt-3 pt-3 border-t">
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    setResultados(breakdown.items.map((item: ImportedWindowBreakdownItem) => ({
                                                        id: item.id,
                                                        ancho: item.ancho,
                                                        alto: item.alto,
                                                        resCabRiel: item.resCabRiel || 0,
                                                        resLateral: item.resLateral || 0,
                                                        resJambas: item.resJambas || 0,
                                                        resCabAlfDiv: item.resCabAlfDiv || 0,
                                                        resVAnchoDiv: item.resVAnchoDiv || 0,
                                                        resVAltura: item.resVAltura || 0
                                                    })))
                                                    setContador(breakdown.items.length)
                                                    setNombreCliente(breakdown.clientName || "")
                                                    setNombreTecnico(breakdown.technicianName || "")
                                                    setDatosGuardados(true)
                                                    setCurrentBreakdownId(breakdown.id)
                                                    setMostrarHistorial(false)
                                                }}
                                            >
                                                Continuar Editando
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Dialogo de reinicio con ventanas pendientes */}
            <Dialog open={mostrarReinicioDialog} onOpenChange={setMostrarReinicioDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ventanas Pendientes de Edición</DialogTitle>
                        <DialogDescription>
                            Se encontraron {breakdownsPendientes.length} desglose(s) pendiente(s) sin imprimir para {nombreCliente} con técnico {nombreTecnico}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-muted-foreground mb-4">
                            ¿Qué deseas hacer con estas ventanas pendientes?
                        </p>
                        <div className="space-y-2">
                            {breakdownsPendientes.map((breakdown) => (
                                <div key={breakdown.id} className="text-sm p-2 border rounded">
                                    <p className="font-medium">{breakdown.totalWindows} ventana(s)</p>
                                    <p className="text-xs text-muted-foreground">
                                        Creado: {new Date(breakdown.createdAt).toLocaleString('es-DO')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setMostrarReinicioDialog(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleEliminarPendientes}
                        >
                            Eliminar
                        </Button>
                        <Button
                            onClick={handleSeguirEditando}
                        >
                            Seguir Editando
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
