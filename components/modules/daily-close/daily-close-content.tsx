"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PrintButton } from "./print-button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import "./daily-close-print.css"

interface DailyCloseContentProps {
    today: Date
    invoices: any[]
    transactions: any[]
    payments: any[]
    totalBilled: number
    totalCollected: number
    cashCollected: number
    otherCollected: number
    totalExpenses: number
    netCashInDrawer: number
}

const BILLS_RD = [1, 5, 10, 25, 50, 100, 200, 500, 1000, 2000]
const BILLS_USD = [1, 5, 10, 100]
const BILLS_EUR = [1, 5, 10, 20, 50, 100]

export function DailyCloseContent({
    today,
    invoices,
    transactions,
    payments,
    totalBilled,
    totalCollected,
    cashCollected,
    otherCollected,
    totalExpenses,
    netCashInDrawer
}: DailyCloseContentProps) {
    const [countsRD, setCountsRD] = useState<Record<number, number>>({})
    const [countsUSD, setCountsUSD] = useState<Record<number, number>>({})
    const [countsEUR, setCountsEUR] = useState<Record<number, number>>({})

    const [hasUSD, setHasUSD] = useState(false)
    const [hasEUR, setHasEUR] = useState(false)
    const [currentTime, setCurrentTime] = useState("")

    useEffect(() => {
        setCurrentTime(new Date().toLocaleTimeString())
    }, [])

    const calculateTotal = (counts: Record<number, number>, denoms: number[]) => {
        return denoms.reduce((acc, denom) => acc + (denom * (counts[denom] || 0)), 0)
    }

    const totalRD = calculateTotal(countsRD, BILLS_RD)
    const totalUSD = calculateTotal(countsUSD, BILLS_USD)
    const totalEUR = calculateTotal(countsEUR, BILLS_EUR)

    const handleCountChange = (
        currency: 'RD' | 'USD' | 'EUR',
        denom: number,
        value: string
    ) => {
        const count = parseInt(value) || 0
        if (currency === 'RD') setCountsRD(prev => ({ ...prev, [denom]: count }))
        if (currency === 'USD') setCountsUSD(prev => ({ ...prev, [denom]: count }))
        if (currency === 'EUR') setCountsEUR(prev => ({ ...prev, [denom]: count }))
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            {/* Header - No imprimir en pantalla, pero sí en impresión */}
            <div className="flex items-center justify-between no-print">
                <h2 className="text-3xl font-bold tracking-tight no-print">Cierre de Día ({today.toLocaleDateString()})</h2>
                <PrintButton />
            </div>

            {/* Print Header - Solo visible al imprimir */}
            <div className="print-only-header">
                <h1>REPORTE DE CIERRE DIARIO</h1>
                <p>Fecha: {today.toLocaleDateString()} - Hora: {currentTime}</p>
            </div>

            {/* Cuadros de resumen estilo Caja Chica - Solo imprimir */}
            <div className="print-summary-cards grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
                <div>
                    <p>Facturación</p>
                    <p>{formatCurrency(totalBilled)}</p>
                </div>
                <div>
                    <p>Ingresos</p>
                    <p>{formatCurrency(totalCollected)}</p>
                </div>
                <div>
                    <p>Gastos</p>
                    <p>-{formatCurrency(totalExpenses)}</p>
                </div>
                <div>
                    <p>Efectivo en Caja</p>
                    <p>{formatCurrency(netCashInDrawer)}</p>
                </div>
            </div>

            {/* Stats Cards - No imprimir */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 no-print">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                        <CardTitle className="text-sm font-medium">Facturación (Día)</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3">
                        <div className="text-2xl font-bold leading-none">{formatCurrency(totalBilled)}</div>
                        <p className="text-xs text-muted-foreground leading-none mt-0">Volumen de facturas creadas</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                        <CardTitle className="text-sm font-medium text-green-700">Ingresos (Cobrado)</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3">
                        <div className="text-2xl font-bold text-green-700 leading-none">{formatCurrency(totalCollected)}</div>
                        <p className="text-xs text-muted-foreground leading-none mt-0">Total dinero recibido hoy</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                        <CardTitle className="text-sm font-medium text-red-600">Gastos (Caja)</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3">
                        <div className="text-2xl font-bold text-red-600 leading-none">-{formatCurrency(totalExpenses)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                        <CardTitle className="text-sm font-medium">Efectivo en Caja (Neto)</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3">
                        <div className="text-2xl font-bold text-blue-700 leading-none">{formatCurrency(netCashInDrawer)}</div>
                        <div className="text-xs text-blue-600 leading-none mt-0">
                            Efec: {formatCurrency(cashCollected)} / Banco: {formatCurrency(otherCollected)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Bill Breakdown Section */}
            <div className={`grid ${hasUSD && hasEUR ? 'md:grid-cols-3' : hasUSD || hasEUR ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-8 mt-8 print-breakdown`}>
                {/* RD Bills */}
                <div className="print-breakdown-section">
                    <h3 className="text-lg font-bold mb-2">Desglose de Billetes RD$</h3>
                    <div className="border rounded-md p-4 bg-white">
                        {BILLS_RD.map(denom => (
                            <div key={denom} className={`print-bill-row flex items-center gap-2 mb-1 ${!countsRD[denom] ? 'hide-zero' : ''}`}>
                                <span className="w-12 text-right font-mono">{denom}</span>
                                <span>x</span>
                                <Input
                                    className="h-8 w-20 text-right font-mono"
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={countsRD[denom] || ''}
                                    onChange={(e) => handleCountChange('RD', denom, e.target.value)}
                                />
                                <span>=</span>
                                <span className="flex-1 text-right font-mono">{formatCurrency(denom * (countsRD[denom] || 0))}</span>
                            </div>
                        ))}
                        <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                            <span>Total Billetes RD$:</span>
                            <span>{formatCurrency(totalRD)}</span>
                        </div>
                    </div>
                </div>

                {/* USD Bills */}
                <div className={`print-breakdown-section ${!hasUSD ? 'no-print-usd' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold">Desglose US$</h3>
                        <div className="flex items-center space-x-2 no-print">
                            <Checkbox id="usd" checked={hasUSD} onCheckedChange={(c) => setHasUSD(!!c)} />
                            <Label htmlFor="usd">Incluir</Label>
                        </div>
                    </div>
                    {hasUSD && (
                        <div className="border rounded-md p-4 bg-white">
                            {BILLS_USD.map(denom => (
                                <div key={denom} className={`print-bill-row flex items-center gap-2 mb-1 ${!countsUSD[denom] ? 'hide-zero' : ''}`}>
                                    <span className="w-12 text-right font-mono">{denom}</span>
                                    <span>x</span>
                                    <Input
                                        className="h-8 w-20 text-right font-mono"
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={countsUSD[denom] || ''}
                                        onChange={(e) => handleCountChange('USD', denom, e.target.value)}
                                    />
                                    <span>=</span>
                                    <span className="flex-1 text-right font-mono">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(denom * (countsUSD[denom] || 0))}
                                    </span>
                                </div>
                            ))}
                            <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                                <span>Total US$:</span>
                                <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalUSD)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* EUR Bills */}
                <div className={`print-breakdown-section ${!hasEUR ? 'no-print-eur' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold">Desglose €</h3>
                        <div className="flex items-center space-x-2 no-print">
                            <Checkbox id="eur" checked={hasEUR} onCheckedChange={(c) => setHasEUR(!!c)} />
                            <Label htmlFor="eur">Incluir</Label>
                        </div>
                    </div>
                    {hasEUR && (
                        <div className="border rounded-md p-4 bg-white">
                            {BILLS_EUR.map(denom => (
                                <div key={denom} className={`print-bill-row flex items-center gap-2 mb-1 ${!countsEUR[denom] ? 'hide-zero' : ''}`}>
                                    <span className="w-12 text-right font-mono">{denom}</span>
                                    <span>x</span>
                                    <Input
                                        className="h-8 w-20 text-right font-mono"
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={countsEUR[denom] || ''}
                                        onChange={(e) => handleCountChange('EUR', denom, e.target.value)}
                                    />
                                    <span>=</span>
                                    <span className="flex-1 text-right font-mono">
                                        {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(denom * (countsEUR[denom] || 0))}
                                    </span>
                                </div>
                            ))}
                            <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                                <span>Total €:</span>
                                <span>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalEUR)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Print Friendly Summary & Lists */}
            <div className="mt-8">
                {/* Resumen de Cuadre */}
                <div className="border rounded-lg p-4 bg-white mb-8 max-w-md print-summary">
                    <h3 className="text-lg font-bold mb-2 border-b pb-2 leading-tight">Resumen de Cuadre</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm leading-snug">

                        {/* System Calculated */}
                        <div className="col-span-2 font-semibold text-gray-500 mb-1 border-b leading-tight">Sistema</div>

                        <div className="flex justify-between leading-tight">
                            <span>(+) Efec. Sist:</span>
                            <span className="font-mono">{formatCurrency(netCashInDrawer)}</span>
                        </div>
                        {/* Physical Count */}
                        <div className="col-span-2 font-semibold text-gray-500 mb-1 border-b mt-1 leading-tight">Físico</div>
                        <div className="flex justify-between leading-tight">
                            <span>(+) Conte Billetes RD:</span>
                            <span className="font-mono">{formatCurrency(totalRD)}</span>
                        </div>

                        <div className="col-span-2 border-t pt-1 mt-1"></div>

                        <div className="flex justify-between font-bold text-lg leading-tight">
                            <span>{totalRD - netCashInDrawer >= 0 ? "Sobrando" : "Faltando"}:</span>
                            <span className={`font-mono ${totalRD - netCashInDrawer < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {formatCurrency(totalRD - netCashInDrawer)}
                            </span>
                        </div>

                        {/* Totals for Foreign if any */}
                        {(hasUSD || hasEUR) && (
                            <>
                                <div className="col-span-2 border-t pt-1 mt-1 font-semibold text-gray-500 leading-tight">Divisas</div>
                                {hasUSD && (
                                    <div className="flex justify-between">
                                        <span>Total USD:</span>
                                        <span className="font-mono">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalUSD)}</span>
                                    </div>
                                )}
                                {hasEUR && (
                                    <div className="flex justify-between">
                                        <span>Total EUR:</span>
                                        <span className="font-mono">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalEUR)}</span>
                                    </div>
                                )}
                            </>
                        )}

                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Invoices List */}
                    <div>
                        <h3 className="text-lg font-bold mb-4">Detalle de Ventas</h3>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Hora</TableHead>
                                        <TableHead>Factura #</TableHead>
                                        <TableHead>Metodo</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoices.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No hay ventas hoy</TableCell></TableRow>}
                                    {invoices.map((inv) => (
                                        <TableRow key={inv.id}>
                                            <TableCell>{new Date(inv.createdAt).toLocaleTimeString()}</TableCell>
                                            <TableCell className="font-mono">{String(inv.sequenceNumber).padStart(6, '0')}</TableCell>
                                            <TableCell>{inv.paymentMethod || 'CASH'}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(Number(inv.total))}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Expenses List */}
                    <div>
                        <h3 className="text-lg font-bold mb-4">Detalle de Gastos</h3>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Hora</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No hay gastos hoy</TableCell></TableRow>}
                                    {transactions.map((t) => (
                                        <TableRow key={t.id}>
                                            <TableCell>{new Date(t.date).toLocaleTimeString()}</TableCell>
                                            <TableCell>{t.description}</TableCell>
                                            <TableCell className="text-right text-red-600">-{formatCurrency(Number(t.amount))}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer with signatures - Solo imprimir */}
            <div className="print-footer">
                <div className="print-signature">
                    <div className="print-signature-line">Entregado por</div>
                </div>
                <div className="print-signature">
                    <div className="print-signature-line">Recibido por</div>
                </div>
            </div>
        </div>
    )
}