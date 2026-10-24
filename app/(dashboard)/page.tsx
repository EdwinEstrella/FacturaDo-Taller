import Link from "next/link"
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, FileSignature, Landmark, Plus, Receipt, Users, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader, StatTile, StatusPill, type PillTone } from "@/components/modules/shared/list-page"
import { MonthlyChart } from "@/components/modules/dashboard/monthly-chart"
import { PeriodSwitcher } from "@/components/modules/dashboard/period-switcher"
import { getDashboardData, parsePeriod, PERIOD_LABELS, type Trend } from "@/lib/dashboard-stats"
import { formatDateDO } from "@/lib/date-utils"
import { formatCurrency, formatQuantity } from "@/lib/utils"

export const dynamic = "force-dynamic"

const PAYMENT_METHODS: Record<string, string> = {
    CASH: "Efectivo",
    TRANSFER: "Transferencia",
    CARD: "Tarjeta",
    CHECK: "Cheque",
    CREDIT: "Crédito",
}

// En los indicadores se muestran montos redondeados para que quepan completos.
const money = (n: number) => `RD$${Math.round(n).toLocaleString("en-US")}`

const STATUS: Record<string, { label: string; tone: PillTone }> = {
    PAID: { label: "Pagada", tone: "green" },
    PENDING: { label: "Pendiente", tone: "amber" },
    CANCELLED: { label: "Cancelada", tone: "slate" },
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
    const period = parsePeriod((await searchParams).p)
    const data = await getDashboardData(period)
    const labels = PERIOD_LABELS[period]
    const mixTotal = data.paymentMix.reduce((acc, m) => acc + m.amount, 0)
    const topProductMax = data.topProducts[0]?.amount || 1

    return (
        <div className="flex-1 space-y-6">
            <PageHeader
                title="Panel"
                description={`Resumen del negocio · ${labels.current}, comparado con ${labels.previous} a la misma altura.`}
                actions={
                    <>
                        <PeriodSwitcher value={period} />
                        <Button asChild>
                            <Link href="/invoices/create?type=INVOICE">
                                <Plus className="mr-2 h-4 w-4" />
                                Nueva Factura
                            </Link>
                        </Button>
                    </>
                }
            />

            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatTile
                    label="Cobrado"
                    value={money(data.collected.value)}
                    hint={<TrendLine trend={data.collected} previousLabel={labels.previous} />}
                    icon={<Wallet />}
                    tone="green"
                />
                <StatTile
                    label="Facturado"
                    value={money(data.billed.value)}
                    hint={<TrendLine trend={data.billed} previousLabel={labels.previous} extra={`${data.invoiceCount.value} ${data.invoiceCount.value === 1 ? "factura" : "facturas"}`} />}
                    icon={<Receipt />}
                    tone="blue"
                />
                <StatTile
                    label="Por cobrar"
                    value={money(data.receivable)}
                    hint={`${data.receivableCount} ${data.receivableCount === 1 ? "factura pendiente" : "facturas pendientes"} en total`}
                    icon={<Landmark />}
                    tone="amber"
                />
                <StatTile
                    label="Cotizado"
                    value={money(data.quoted.value)}
                    hint={<TrendLine trend={data.quoted} previousLabel={labels.previous} extra={`${data.quoteCount} cotiz. · ${data.quoteAccepted} aceptadas`} />}
                    icon={<FileSignature />}
                    tone="slate"
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <Panel className="lg:col-span-2" title="Facturado y cobrado" description="Últimos 6 meses">
                    <MonthlyChart data={data.monthly} />
                </Panel>

                <div className="space-y-6">
                    <Panel title="Cobros por forma de pago" description={labels.current}>
                        {data.paymentMix.length === 0 ? (
                            <Empty text="Sin cobros en este período" />
                        ) : (
                            <ul className="space-y-4">
                                {data.paymentMix.map((m) => {
                                    const pct = mixTotal ? Math.round((m.amount / mixTotal) * 100) : 0
                                    return (
                                        <li key={m.method} className="space-y-1.5">
                                            <div className="flex items-baseline justify-between gap-3 text-sm">
                                                <span className="font-medium text-slate-700">{PAYMENT_METHODS[m.method] || m.method}</span>
                                                <span className="tabular-nums text-slate-900">
                                                    {formatCurrency(m.amount)} <span className="text-slate-400">· {pct}%</span>
                                                </span>
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                <div className="h-full rounded-full bg-slate-800" style={{ width: `${pct}%` }} />
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </Panel>

                    <Panel>
                        <div className="flex items-center justify-between gap-4">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Clientes nuevos</p>
                                <p className="text-2xl font-bold tabular-nums">{data.newClients.value}</p>
                                <TrendLine trend={data.newClients} previousLabel={labels.previous} />
                            </div>
                            <div className="rounded-lg bg-slate-100 p-2.5 text-slate-600">
                                <Users className="size-5" />
                            </div>
                        </div>
                    </Panel>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <Panel title="Lo más vendido" description={labels.current}>
                    {data.topProducts.length === 0 ? (
                        <Empty text="Sin ventas en este período" />
                    ) : (
                        <ul className="space-y-4">
                            {data.topProducts.map((p, i) => (
                                <li key={p.name} className="space-y-1.5">
                                    <div className="flex items-baseline justify-between gap-3 text-sm">
                                        <span className="min-w-0 truncate font-medium text-slate-700">
                                            <span className="mr-2 text-slate-400 tabular-nums">{i + 1}</span>
                                            {p.name}
                                        </span>
                                        <span className="shrink-0 tabular-nums text-slate-900">{formatCurrency(p.amount)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                            <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${Math.max((p.amount / topProductMax) * 100, 2)}%` }} />
                                        </div>
                                        <span className="w-16 text-right text-xs tabular-nums text-slate-500">{formatQuantity(p.quantity)} und.</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <Panel
                    title="Mayores saldos pendientes"
                    description="Clientes con facturas por cobrar"
                    action={<PanelLink href="/receivables">Ver cuentas</PanelLink>}
                >
                    {data.topDebtors.length === 0 ? (
                        <Empty text="No hay saldos pendientes" icon={<CheckCircle2 className="size-5 text-emerald-500" />} />
                    ) : (
                        <ul className="divide-y">
                            {data.topDebtors.map((d) => (
                                <li key={d.name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-slate-800">{d.name}</p>
                                        <p className="text-xs text-slate-500">{d.invoices} {d.invoices === 1 ? "factura" : "facturas"}</p>
                                    </div>
                                    <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-700">{formatCurrency(d.balance)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <Panel
                    title="Últimas facturas"
                    action={<PanelLink href="/invoices">Ver todas</PanelLink>}
                >
                    {data.recentInvoices.length === 0 ? (
                        <Empty text="Todavía no hay facturas" />
                    ) : (
                        <ul className="divide-y">
                            {data.recentInvoices.map((inv) => {
                                const st = STATUS[inv.status] || { label: inv.status, tone: "slate" as PillTone }
                                return (
                                    <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-800">
                                                <span className="mr-2 font-mono text-blue-700">#{String(inv.sequenceNumber).padStart(6, "0")}</span>
                                                {inv.clientName || "Consumidor Final"}
                                            </p>
                                            <p className="text-xs text-slate-500">{formatDateDO(inv.createdAt)}</p>
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1">
                                            <span className="text-sm font-semibold tabular-nums">{formatCurrency(inv.total)}</span>
                                            <StatusPill tone={st.tone}>{st.label}</StatusPill>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </Panel>
            </div>
        </div>
    )
}

function TrendLine({ trend, previousLabel, extra }: { trend: Trend; previousLabel: string; extra?: string }) {
    if (trend.change === null) {
        return <span className="text-xs text-muted-foreground">{extra ? `${extra} · ` : ""}Sin comparación con {previousLabel}</span>
    }
    const up = trend.change >= 0
    const Icon = up ? ArrowUpRight : ArrowDownRight
    return (
        <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span className={`inline-flex items-center font-medium ${up ? "text-emerald-700" : "text-red-600"}`}>
                <Icon className="size-3.5" />
                {Math.abs(trend.change).toFixed(1)}%
            </span>
            vs {previousLabel}
            {extra && <span>· {extra}</span>}
        </span>
    )
}

function Panel({ title, description, action, className = "", children }: {
    title?: string
    description?: string
    action?: React.ReactNode
    className?: string
    children: React.ReactNode
}) {
    return (
        <section className={`rounded-xl border bg-card p-5 shadow-sm ${className}`}>
            {title && (
                <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="font-semibold text-slate-900">{title}</h3>
                        {description && <p className="text-sm text-muted-foreground">{description}</p>}
                    </div>
                    {action}
                </div>
            )}
            {children}
        </section>
    )
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800">
            {children}
            <ArrowRight className="size-3.5" />
        </Link>
    )
}

function Empty({ text, icon }: { text: string; icon?: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            {icon}
            {text}
        </div>
    )
}
