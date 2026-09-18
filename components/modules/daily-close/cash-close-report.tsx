import { formatCurrency, formatQuantity } from "@/lib/utils"
import type { InvoiceData, PaymentData, ExpenseData } from "@/actions/cash-shift-actions"

export interface CashCloseReportData {
    shiftNumber: number
    cashierName: string
    openedAt: string
    closedAt: string | null
    status: string
    openingBalance: number
    totalBilled: number
    totalCollected: number
    cashCollected: number
    otherCollected: number
    totalExpenses: number
    expectedCash: number
    actualCash: number
    discrepancy: number
    billBreakdownRD: Record<string, number>
    billBreakdownUSD: Record<string, number>
    billBreakdownEUR: Record<string, number>
    totalRD: number
    totalUSD: number
    totalEUR: number
    invoices: InvoiceData[]
    payments: PaymentData[]
    expenses: ExpenseData[]
    openingNotes: string | null
    closeNotes: string | null
    // false for an open-shift preview: the physical count isn't done yet.
    arqueoRegistered?: boolean
}

function formatDateTime(value: string | null): string {
    if (!value) return "—"
    return new Intl.DateTimeFormat("es-DO", {
        timeZone: "America/Santo_Domingo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).format(new Date(value))
}

function formatTime(value: string): string {
    return new Intl.DateTimeFormat("es-DO", {
        timeZone: "America/Santo_Domingo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).format(new Date(value))
}

/** Non-zero denominations sorted high to low. */
function denomRows(breakdown: Record<string, number>) {
    return Object.entries(breakdown || {})
        .map(([denom, count]) => ({ denom: Number(denom), count: Number(count) }))
        .filter((r) => r.count > 0)
        .sort((a, b) => b.denom - a.denom)
}

export function CashCloseReport({ data }: { data: CashCloseReportData }) {
    const rowsRD = denomRows(data.billBreakdownRD)
    const rowsUSD = denomRows(data.billBreakdownUSD)
    const rowsEUR = denomRows(data.billBreakdownEUR)
    const isClosed = data.status === "CLOSED"

    return (
        <div className="cash-close-report">
            <style>{`
                @media print {
                    /* margin 0 => el navegador NO imprime su encabezado/pie (fecha, título, URL). */
                    @page { size: A4 portrait; margin: 0; }
                    html, body { background: #fff !important; }
                }
                .cash-close-report {
                    width: 210mm;
                    margin: 0 auto;
                    padding: 12mm;
                    box-sizing: border-box;
                    background: #fff;
                    color: #000;
                    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
                    font-size: 10px;
                    line-height: 1.35;
                }
                .cash-close-report h1 { font-size: 18px; font-weight: 700; margin: 0; letter-spacing: .5px; }
                .cash-close-report h2 {
                    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
                    margin: 14px 0 5px; padding-bottom: 2px; border-bottom: 1.5px solid #000;
                }
                .ccr-meta { display: flex; flex-wrap: wrap; gap: 2px 18px; margin-top: 4px; color: #333; font-size: 10px; }
                .ccr-summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 10px; }
                .ccr-summary div { border: 1px solid #000; padding: 5px 6px; text-align: center; }
                .ccr-summary .lbl { font-size: 8px; text-transform: uppercase; color: #555; letter-spacing: .3px; }
                .ccr-summary .val { font-size: 12px; font-weight: 700; margin-top: 2px; }
                .cash-close-report table { width: 100%; border-collapse: collapse; }
                .cash-close-report th, .cash-close-report td { border: 1px solid #bbb; padding: 2px 5px; text-align: left; }
                .cash-close-report th { background: #eee; font-weight: 700; font-size: 9px; text-transform: uppercase; }
                .num { text-align: right; font-variant-numeric: tabular-nums; }
                .ccr-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
                .ccr-inv { border: 1px solid #000; margin-bottom: 6px; page-break-inside: avoid; }
                .ccr-inv-head { display: flex; justify-content: space-between; gap: 8px; background: #f0f0f0; padding: 3px 6px; border-bottom: 1px solid #000; font-size: 9px; }
                .ccr-inv-head strong { font-family: ui-monospace, monospace; }
                .ccr-cuadre { border: 1px solid #000; padding: 6px 8px; }
                .ccr-cuadre .line { display: flex; justify-content: space-between; padding: 1px 0; }
                .ccr-cuadre .total { border-top: 1px solid #000; margin-top: 3px; padding-top: 3px; font-weight: 700; font-size: 11px; }
                .ccr-notes { border: 1px solid #000; padding: 5px 8px; margin-top: 10px; }
                .ccr-sign { display: flex; justify-content: space-between; margin-top: 26px; }
                .ccr-sign div { width: 46%; border-top: 1px solid #000; padding-top: 3px; text-align: center; font-size: 9px; }
                .muted { color: #666; }
            `}</style>

            {/* Encabezado */}
            <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "6px" }}>
                <h1>CIERRE DE CAJA</h1>
                <div className="ccr-meta" style={{ justifyContent: "center" }}>
                    <span>Turno #{data.shiftNumber}</span>
                    <span>Cajero: {data.cashierName}</span>
                    <span>Apertura: {formatDateTime(data.openedAt)}</span>
                    <span>{isClosed ? "Cierre" : "Emisión"}: {formatDateTime(data.closedAt || new Date().toISOString())}</span>
                </div>
            </div>

            {/* Resumen */}
            <div className="ccr-summary">
                <div><div className="lbl">Fondo Inicial</div><div className="val">{formatCurrency(data.openingBalance)}</div></div>
                <div><div className="lbl">Facturado</div><div className="val">{formatCurrency(data.totalBilled)}</div></div>
                <div><div className="lbl">Cobrado</div><div className="val">{formatCurrency(data.totalCollected)}</div></div>
                <div><div className="lbl">Gastos</div><div className="val">-{formatCurrency(data.totalExpenses)}</div></div>
                <div><div className="lbl">Efectivo Físico</div><div className="val">{formatCurrency(data.totalRD)}</div></div>
            </div>

            {/* Detalle de ventas con ítems */}
            <h2>Detalle de Ventas ({data.invoices.length})</h2>
            {data.invoices.length === 0 ? (
                <p className="muted">Sin facturas emitidas en este turno.</p>
            ) : (
                data.invoices.map((inv) => (
                    <div key={inv.id} className="ccr-inv">
                        <div className="ccr-inv-head">
                            <span>
                                <strong>#{String(inv.sequenceNumber).padStart(6, "0")}</strong>
                                {" · "}{formatTime(inv.createdAt)}
                                {" · "}{inv.clientName || "Consumidor Final"}
                                {" · "}{inv.paymentMethod || "CASH"}
                                {" · "}{inv.status === "PAID" ? "PAGADA" : inv.status === "PENDING" ? "PENDIENTE" : (inv.status || "EMITIDA")}
                            </span>
                            <strong>{formatCurrency(inv.total)}</strong>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Producto / Servicio</th>
                                    <th className="num" style={{ width: "12%" }}>Cant.</th>
                                    <th className="num" style={{ width: "18%" }}>Precio</th>
                                    <th className="num" style={{ width: "20%" }}>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inv.items && inv.items.length > 0 ? (
                                    inv.items.map((it, idx) => (
                                        <tr key={idx}>
                                            <td>{it.productName}</td>
                                            <td className="num">{formatQuantity(it.quantity)}</td>
                                            <td className="num">{formatCurrency(it.price)}</td>
                                            <td className="num">{formatCurrency(it.price * it.quantity)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={4} className="muted" style={{ textAlign: "center" }}>Sin desglose de ítems</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ))
            )}

            {/* Cobros y gastos */}
            <div className="ccr-cols">
                <div>
                    <h2>Cobros Recibidos ({data.payments.length})</h2>
                    <table>
                        <thead>
                            <tr><th>Hora</th><th>Factura</th><th>Método</th><th className="num">Monto</th></tr>
                        </thead>
                        <tbody>
                            {data.payments.length === 0 ? (
                                <tr><td colSpan={4} className="muted" style={{ textAlign: "center" }}>Sin cobros.</td></tr>
                            ) : (
                                data.payments.map((p) => (
                                    <tr key={p.id}>
                                        <td>{formatTime(p.date)}</td>
                                        <td>{p.invoiceSequenceNumber ? `#${String(p.invoiceSequenceNumber).padStart(6, "0")}` : "—"}</td>
                                        <td>{p.method || "CASH"}</td>
                                        <td className="num">{formatCurrency(p.amount)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    <div className="muted" style={{ marginTop: "3px" }}>
                        Efectivo: {formatCurrency(data.cashCollected)} · Banco/Otros: {formatCurrency(data.otherCollected)}
                    </div>
                </div>

                <div>
                    <h2>Gastos de Caja ({data.expenses.length})</h2>
                    <table>
                        <thead>
                            <tr><th>Hora</th><th>Descripción</th><th className="num">Monto</th></tr>
                        </thead>
                        <tbody>
                            {data.expenses.length === 0 ? (
                                <tr><td colSpan={3} className="muted" style={{ textAlign: "center" }}>Sin gastos.</td></tr>
                            ) : (
                                data.expenses.map((e) => (
                                    <tr key={e.id}>
                                        <td>{formatTime(e.date)}</td>
                                        <td>{e.description}</td>
                                        <td className="num">-{formatCurrency(e.amount)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Arqueo y cuadre */}
            <div className="ccr-cols" style={{ marginTop: "6px" }}>
                <div>
                    <h2>Arqueo de Efectivo</h2>
                    {rowsRD.length === 0 && rowsUSD.length === 0 && rowsEUR.length === 0 ? (
                        <p className="muted">Sin desglose de billetes registrado.</p>
                    ) : (
                        <table>
                            <thead>
                                <tr><th>Denom.</th><th className="num">Cant.</th><th className="num">Total</th></tr>
                            </thead>
                            <tbody>
                                {rowsRD.map((r) => (
                                    <tr key={`rd-${r.denom}`}>
                                        <td>RD$ {r.denom}</td>
                                        <td className="num">{r.count}</td>
                                        <td className="num">{formatCurrency(r.denom * r.count)}</td>
                                    </tr>
                                ))}
                                {rowsUSD.map((r) => (
                                    <tr key={`usd-${r.denom}`}>
                                        <td>US$ {r.denom}</td>
                                        <td className="num">{r.count}</td>
                                        <td className="num">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(r.denom * r.count)}</td>
                                    </tr>
                                ))}
                                {rowsEUR.map((r) => (
                                    <tr key={`eur-${r.denom}`}>
                                        <td>€ {r.denom}</td>
                                        <td className="num">{r.count}</td>
                                        <td className="num">{new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(r.denom * r.count)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div>
                    <h2>Cuadre del Turno</h2>
                    <div className="ccr-cuadre">
                        <div className="line"><span>Fondo Inicial</span><span>{formatCurrency(data.openingBalance)}</span></div>
                        <div className="line"><span>(+) Cobros en Efectivo</span><span>{formatCurrency(data.cashCollected)}</span></div>
                        <div className="line"><span>(-) Gastos de Caja</span><span>-{formatCurrency(data.totalExpenses)}</span></div>
                        <div className="line total"><span>Efectivo Esperado</span><span>{formatCurrency(data.expectedCash)}</span></div>
                        {data.arqueoRegistered === false ? (
                            <div className="line muted"><span>Arqueo Físico</span><span>Pendiente al cierre</span></div>
                        ) : (
                            <>
                                <div className="line"><span>Efectivo Físico Arqueado</span><span>{formatCurrency(data.totalRD)}</span></div>
                                <div className="line total">
                                    <span>{data.discrepancy === 0 ? "Cuadre Exacto" : data.discrepancy > 0 ? "Sobrante" : "Faltante"}</span>
                                    <span>{data.discrepancy < 0 ? "-" : data.discrepancy > 0 ? "+" : ""}{formatCurrency(Math.abs(data.discrepancy))}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Notas */}
            {(data.openingNotes || (data.closeNotes && data.closeNotes.trim())) && (
                <div className="ccr-notes">
                    <strong>Notas del Turno</strong>
                    {data.openingNotes && <div>Apertura: {data.openingNotes}</div>}
                    {data.closeNotes && data.closeNotes.trim() && <div>Cierre: {data.closeNotes}</div>}
                </div>
            )}

            {/* Firmas */}
            <div className="ccr-sign">
                <div>Entregado por: {data.cashierName}</div>
                <div>Recibido por (Supervisor / Administración)</div>
            </div>
        </div>
    )
}
