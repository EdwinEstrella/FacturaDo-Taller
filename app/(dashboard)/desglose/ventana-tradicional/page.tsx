"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface CalculationResults {
    id: number
    ancho: number
    alto: number
    notas: string
    resRiel: number
    resLateral: number
    resJambas: number
    resCabAlfDiv: number
    resVAnchoDiv: number
    resVAlto: number
}

function decimalToFraction(dec: number): string {
    const whole = Math.floor(dec)
    const fraction = dec - whole

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
    const [notas, setNotas] = useState<string>("")
    const [resultados, setResultados] = useState<CalculationResults[]>([])
    const [contador, setContador] = useState<number>(0)
    const [mostrarImpresion, setMostrarImpresion] = useState<boolean>(false)
    const [filaEditando, setFilaEditando] = useState<number | null>(null)
    const [nombreCliente, setNombreCliente] = useState<string>("")
    const [nombreTecnico, setNombreTecnico] = useState<string>("")
    const [isClient, setIsClient] = useState<boolean>(false)

    // Evitar error de hidratación - inicializar isClient
    useState(() => {
        setIsClient(true)
    })

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

    const calcular = () => {
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
            const resJamba = altoValue - desJamba

            // Cab/alf: 1/2 (0.5) al ancho ORIGINAL, dividido entre 2
            const desCabAlf = 0.5
            const resCabAlf = anchoValue - desCabAlf
            const resCabAlfDiv = resCabAlf / 2

            // Des. V. Ancho: 4 3/8 (4.375) al ancho ORIGINAL, dividido entre 2
            const desVAncho = 4.375
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
                            notas: notas,
                            resRiel,
                            resLateral,
                            resJambas,
                            resCabAlfDiv,
                            resVAnchoDiv,
                            resVAlto
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
                    notas: notas,
                    resRiel,
                    resLateral,
                    resJambas,
                    resCabAlfDiv,
                    resVAnchoDiv,
                    resVAlto
                }
                setResultados([...resultados, nuevoResultado])
                setContador(contador + 1)
            }

            // Limpiar inputs para siguiente cálculo
            setAlto("")
            setAncho("")
            setNotas("")

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
            setNotas(fila.notas)
            setFilaEditando(id)
        }
    }

    const eliminarFila = (id: number) => {
        setResultados(resultados.filter(r => r.id !== id))
        if (filaEditando === id) {
            setFilaEditando(null)
            setAlto("")
            setAncho("")
            setNotas("")
        }
    }

    const cancelarEdicion = () => {
        setFilaEditando(null)
        setAlto("")
        setAncho("")
        setNotas("")
    }

    const limpiar = () => {
        setAlto("")
        setAncho("")
        setNotas("")
        setResultados([])
        setContador(0)
    }

    const handleImprimir = () => {
        setMostrarImpresion(true)
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Ventana Tradicional</h1>
                <p className="text-muted-foreground">
                    Calculadora para ventanas tradicionales
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Resultados a la izquierda */}
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
                                            <TableHead>Notas</TableHead>
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
                                                <TableCell className="text-xs">{resultado.notas}</TableCell>
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
                                <Button onClick={handleImprimir}>
                                    Imprimir
                                </Button>
                                <Button variant="outline" onClick={limpiar}>
                                    Limpiar Todo
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Inputs a la derecha */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {filaEditando !== null ? `Editando Fila #${filaEditando}` : "Medidas de la Ventana"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-4">
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
                            <div className="space-y-2">
                                <Label htmlFor="notas">Notas (opcional)</Label>
                                <Input
                                    id="notas"
                                    type="text"
                                    placeholder="Ej: Tipo de vidrio, color, etc."
                                    value={notas}
                                    onChange={(e) => setNotas(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={calcular}
                                disabled={!alto || !ancho}
                                className="flex-1"
                                variant={filaEditando !== null ? "default" : "default"}
                            >
                                {filaEditando !== null ? "Actualizar (Enter)" : "Calcular (Enter)"}
                            </Button>
                            {filaEditando !== null ? (
                                <Button variant="outline" onClick={cancelarEdicion}>
                                    Cancelar
                                </Button>
                            ) : (
                                <Button variant="outline" onClick={limpiar}>
                                    Reiniciar
                                </Button>
                            )}
                        </div>

                        <div className="text-sm text-muted-foreground">
                            <p className="font-medium mb-2">Instrucciones:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Ingresa medidas en fracciones (ej: 14 1/4) o decimales (ej: 14.25)</li>
                                <li>Presiona Enter o click en Calcular</li>
                                <li>Haz click en cualquier fila para editarla</li>
                                <li>Los cálculos específicos se agregarán cuando los proporciones</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
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

                    <Card className="mb-4 no-print">
                        <CardHeader>
                            <CardTitle>Previsualización de Impresión</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="mb-4">Se imprimirán {resultados.length} ventanas en formato térmico (80mm).</p>
                            <div className="flex gap-2">
                                <Button onClick={() => window.print()}>Imprimir</Button>
                                <Button variant="outline" onClick={() => setMostrarImpresion(false)}>Cerrar</Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contenido de impresión térmica */}
                    <div id="printable-area-tradicional" className="font-mono text-sm w-[80mm] p-2 bg-white text-black mx-auto">
                        {/* Header */}
                        <div className="text-center mb-3">
                            <h1 className="font-bold text-lg uppercase">FacturaDO</h1>
                            <p className="text-xs">Ventana Tradicional</p>
                            <p className="text-xs">Fecha: {isClient && new Date().toLocaleDateString('es-DO')}</p>
                            <p className="text-xs">Hora: {isClient && new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>

                        <div className="border-b border-dashed border-black mb-2"></div>

                        {/* Tabla de resultados */}
                        <table className="w-full mb-2 text-xs">
                            <thead>
                                <tr className="border-b border-black">
                                    <th className="text-left py-1 w-6">Fab</th>
                                    <th className="text-center py-1 w-8">No</th>
                                    <th className="text-center py-1">Ancho</th>
                                    <th className="text-center py-1">Alto</th>
                                    <th className="text-left py-1">Notas</th>
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
                                        <td className="py-1 text-left text-[10px]">{resultado.notas}</td>
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
                            <p className="text-[10px] italic">Generado por FacturaDO - Ventana Tradicional</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
