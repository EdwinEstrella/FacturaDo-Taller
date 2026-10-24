"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatCurrency } from "@/lib/utils"

// Paleta validada (azul / aqua): se distinguen con daltonismo; los valores siempre van en texto.
const SERIES = [
    { key: "facturado", label: "Facturado", color: "#2a78d6" },
    { key: "cobrado", label: "Cobrado", color: "#1baf7a" },
] as const

const compact = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n)

type Datum = { name: string; facturado: number; cobrado: number }

export function MonthlyChart({ data }: { data: Datum[] }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-5 text-sm">
                {SERIES.map((s) => (
                    <span key={s.key} className="flex items-center gap-2 text-slate-600">
                        <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
                        {s.label}
                    </span>
                ))}
            </div>
            <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            width={48}
                            tick={{ fill: "#94a3b8", fontSize: 12 }}
                            tickFormatter={compact}
                        />
                        <Tooltip
                            cursor={{ fill: "#f1f5f9" }}
                            content={({ active, payload, label }) =>
                                active && payload?.length ? (
                                    <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-md">
                                        <p className="mb-1 font-semibold text-slate-900">{label}</p>
                                        {SERIES.map((s) => {
                                            const v = payload.find((p) => p.dataKey === s.key)?.value
                                            return (
                                                <p key={s.key} className="flex items-center gap-2 text-slate-600">
                                                    <span className="size-2 rounded-sm" style={{ background: s.color }} />
                                                    {s.label}
                                                    <span className="ml-auto pl-4 font-medium tabular-nums text-slate-900">{formatCurrency(Number(v || 0))}</span>
                                                </p>
                                            )
                                        })}
                                    </div>
                                ) : null
                            }
                        />
                        {SERIES.map((s) => (
                            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {/* Valores en tabla: el gráfico nunca depende solo del color */}
            <div className="grid grid-cols-6 gap-2 border-t pt-3 text-xs">
                {data.map((d) => (
                    <div key={d.name} className="space-y-0.5 text-center">
                        <p className="font-medium text-slate-500">{d.name}</p>
                        <p className="tabular-nums text-slate-900">{compact(d.facturado)}</p>
                        <p className="tabular-nums text-slate-500">{compact(d.cobrado)}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}
