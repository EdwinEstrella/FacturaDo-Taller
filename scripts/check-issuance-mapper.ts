// Functional check for e-CF XML mapper (real invoices E31, E32 and credit notes E34).
// Run with: npx tsx scripts/check-issuance-mapper.ts

import { DOMParser } from "@xmldom/xmldom"
import { IssuanceError } from "../lib/fiscal/issuance/errors"
import { buildCreditNoteEcfXml, buildInvoiceEcfXml, computeEcfTotals } from "../lib/fiscal/issuance/mapper"
import type { CreditNoteSnapshot, InvoiceSnapshot, IssuerSnapshot } from "../lib/fiscal/issuance/types"

const CANONICAL_ORDERS: Record<string, string[]> = {
    ECF: ["Encabezado", "DetallesItems", "InformacionReferencia"],
    Encabezado: ["Version", "IdDoc", "Emisor", "Comprador", "Totales"],
    IdDoc: [
        "TipoeCF",
        "eNCF",
        "FechaVencimientoSecuencia",
        "IndicadorNotaCredito",
        "IndicadorMontoGravado",
        "TipoIngresos",
        "TipoPago",
        "FechaLimitePago",
        "TerminoPago",
        "TablaFormasPago",
    ],
    Emisor: [
        "RNCEmisor",
        "RazonSocialEmisor",
        "NombreComercial",
        "Sucursal",
        "DireccionEmisor",
        "Municipio",
        "Provincia",
        "TablaTelefonoEmisor",
        "CorreoEmisor",
        "WebSite",
        "ActividadEconomica",
        "FechaEmision",
    ],
    Comprador: ["RNCComprador", "RazonSocialComprador", "CorreoComprador", "DireccionComprador"],
    Totales: [
        "MontoGravadoTotal",
        "MontoGravadoI1",
        "MontoExento",
        "ITBIS1",
        "TotalITBIS",
        "TotalITBIS1",
        "MontoTotal",
    ],
    Item: [
        "NumeroLinea",
        "IndicadorFacturacion",
        "NombreItem",
        "IndicadorBienoServicio",
        "CantidadItem",
        "UnidadMedida",
        "PrecioUnitarioItem",
        "DescuentoMonto",
        "MontoItem",
    ],
    InformacionReferencia: [
        "NCFModificado",
        "FechaNCFModificado",
        "CodigoModificacion",
        "RazonModificacion",
    ],
}

function parseAndValidateXml(xml: string): Document {
    const errors: string[] = []
    const parser = new DOMParser({
        errorHandler: {
            warning: (w) => errors.push(`Warning: ${w}`),
            error: (e) => errors.push(`Error: ${e}`),
            fatalError: (fe) => errors.push(`FatalError: ${fe}`),
        },
    })
    const doc = parser.parseFromString(xml, "text/xml")
    if (errors.length > 0) {
        throw new Error(`XML parsing failed: ${errors.join("; ")}`)
    }
    return doc
}

function assertElementOrder(doc: Document, containerTag: string, canonicalList: string[]) {
    const containers = doc.getElementsByTagName(containerTag)
    for (let i = 0; i < containers.length; i++) {
        const container = containers[i]
        const childNames: string[] = []
        for (let j = 0; j < container.childNodes.length; j++) {
            const child = container.childNodes[j]
            if (child.nodeType === 1) {
                childNames.push((child as Element).tagName)
            }
        }

        let lastIndex = -1
        for (const name of childNames) {
            const idx = canonicalList.indexOf(name)
            if (idx === -1) {
                throw new Error(`Element <${name}> in <${containerTag}> is not in canonical list: ${canonicalList.join(", ")}`)
            }
            if (idx < lastIndex) {
                throw new Error(
                    `Element order violation in <${containerTag}>: <${name}> (index ${idx}) appeared after index ${lastIndex}. Expected order: ${canonicalList.join(", ")}`
                )
            }
            lastIndex = idx
        }
    }
}

function getElementText(doc: Document, tagName: string): string | null {
    const els = doc.getElementsByTagName(tagName)
    if (els.length === 0) return null
    return els[0].textContent
}

const testIssuer: IssuerSnapshot = {
    rnc: "133339749",
    legalName: "Taller Mecánico Hermanos Pérez SRL",
    tradeName: "FacturaDo Taller",
    address: "Ave. 27 de Febrero No. 100, Santo Domingo",
    municipality: "010101",
    province: "010000",
    economicActivity: "452001",
    branch: "Principal",
    email: "taller@facturado.lat",
    phone: "809-555-1234",
}

let passedCount = 0
let failedCount = 0

function runCheck(name: string, fn: () => void) {
    try {
        fn()
        console.log(`[PASS] ${name}`)
        passedCount++
    } catch (err) {
        console.error(`[FAIL] ${name}:`, err instanceof Error ? err.message : err)
        failedCount++
    }
}

console.log("=== Checking e-CF XML Mapper ===")

// Case (a): E32 consumer, mixed taxable + exempt lines
runCheck("Case (a): E32 consumer with mixed taxable and exempt lines", () => {
    const invoice: InvoiceSnapshot = {
        ecfType: "E32",
        encf: "E320000000001",
        issuedAt: new Date("2026-11-15T14:30:00Z"),
        buyer: { name: "Cliente Ocasional" }, // No RNC
        lines: [
            {
                name: "Batería 12V 75Ah",
                quantity: 2,
                unitPrice: 1500,
                taxable: true,
                isService: false,
                unitMeasure: "43",
            },
            {
                name: "Mano de obra diagnóstico computarizado",
                quantity: 1,
                unitPrice: 800,
                taxable: false,
                isService: true,
            },
        ],
        payment: { method: "CASH" },
    }

    const now = new Date("2026-11-15T14:30:00Z")
    const { xml, fiscalTotals } = buildInvoiceEcfXml(testIssuer, invoice, now)

    // Parse XML
    const doc = parseAndValidateXml(xml)

    // Assert required tags
    if (getElementText(doc, "TipoeCF") !== "32") throw new Error("TipoeCF must be 32")
    if (getElementText(doc, "eNCF") !== "E320000000001") throw new Error("eNCF must match")
    if (getElementText(doc, "FechaVencimientoSecuencia") !== null) {
        throw new Error("E32 must omit FechaVencimientoSecuencia")
    }
    if (getElementText(doc, "RNCComprador") !== null) {
        throw new Error("E32 consumer must omit RNCComprador when not provided")
    }
    if (getElementText(doc, "RazonSocialComprador") !== "Cliente Ocasional") {
        throw new Error("RazonSocialComprador should be Cliente Ocasional")
    }

    // Balancing assertions
    const gravado = Number(getElementText(doc, "MontoGravadoTotal"))
    const gravadoI1 = Number(getElementText(doc, "MontoGravadoI1"))
    const exento = Number(getElementText(doc, "MontoExento"))
    const itbis1 = Number(getElementText(doc, "ITBIS1"))
    const totalItbis = Number(getElementText(doc, "TotalITBIS"))
    const montoTotal = Number(getElementText(doc, "MontoTotal"))

    if (gravado !== 3000.0) throw new Error(`MontoGravadoTotal expected 3000.00, got ${gravado}`)
    if (gravadoI1 !== 3000.0) throw new Error(`MontoGravadoI1 expected 3000.00, got ${gravadoI1}`)
    if (exento !== 800.0) throw new Error(`MontoExento expected 800.00, got ${exento}`)
    if (itbis1 !== 18) throw new Error(`ITBIS1 expected 18, got ${itbis1}`)
    if (totalItbis !== 540.0) throw new Error(`TotalITBIS expected 540.00, got ${totalItbis}`)
    if (montoTotal !== 4340.0) throw new Error(`MontoTotal expected 4340.00, got ${montoTotal}`)

    // fiscalTotals check
    if (fiscalTotals.taxableAmount !== 3000.0) throw new Error("fiscalTotals taxable mismatch")
    if (fiscalTotals.exemptAmount !== 800.0) throw new Error("fiscalTotals exempt mismatch")
    if (fiscalTotals.itbisAmount !== 540.0) throw new Error("fiscalTotals itbis mismatch")
    if (fiscalTotals.totalAmount !== 4340.0) throw new Error("fiscalTotals total mismatch")

    // Math balance check
    if (Math.abs(gravado + exento + totalItbis - montoTotal) > 0.001) {
        throw new Error("MontoGravadoTotal + MontoExento + TotalITBIS must equal MontoTotal")
    }

    // Line sums check
    const items = doc.getElementsByTagName("Item")
    if (items.length !== 2) throw new Error(`Expected 2 items, got ${items.length}`)
    const item1Monto = Number(items[0].getElementsByTagName("MontoItem")[0].textContent)
    const item2Monto = Number(items[1].getElementsByTagName("MontoItem")[0].textContent)
    if (item1Monto !== 3000.0) throw new Error(`Item 1 MontoItem expected 3000, got ${item1Monto}`)
    if (item2Monto !== 800.0) throw new Error(`Item 2 MontoItem expected 800, got ${item2Monto}`)
    if (Math.abs(item1Monto + item2Monto - (gravado + exento)) > 0.001) {
        throw new Error("Sum of line amounts must equal MontoGravadoTotal + MontoExento")
    }

    // Canonical order checks
    assertElementOrder(doc, "ECF", CANONICAL_ORDERS.ECF)
    assertElementOrder(doc, "Encabezado", CANONICAL_ORDERS.Encabezado)
    assertElementOrder(doc, "IdDoc", CANONICAL_ORDERS.IdDoc)
    assertElementOrder(doc, "Emisor", CANONICAL_ORDERS.Emisor)
    assertElementOrder(doc, "Comprador", CANONICAL_ORDERS.Comprador)
    assertElementOrder(doc, "Totales", CANONICAL_ORDERS.Totales)
    assertElementOrder(doc, "Item", CANONICAL_ORDERS.Item)
})

// Case (b): E31 with buyer RNC, credit payment
runCheck("Case (b): E31 with buyer RNC and credit payment", () => {
    const invoice: InvoiceSnapshot = {
        ecfType: "E31",
        encf: "E310000000002",
        sequenceExpiresOn: "2028-12-31",
        issuedAt: new Date("2026-11-15T15:00:00Z"),
        buyer: {
            rnc: "131880681",
            name: "Transportes del Caribe SRL",
            email: "admin@caribetransport.com",
            address: "Zona Industrial de Haina",
        },
        lines: [
            {
                name: "Amortiguador Delantero Heavy Duty",
                quantity: 4,
                unitPrice: 2500,
                taxable: true,
                isService: false,
                unitMeasure: "43",
            },
        ],
        shipping: 500,
        discount: 200,
        payment: {
            method: "CREDIT",
            dueDate: "2026-12-15",
        },
        totals: {
            subtotal: 9800,
            taxableAmount: 9800,
            exemptAmount: 500,
            itbis: 1764,
            total: 12064,
        },
    }

    const now = new Date("2026-11-15T15:00:00Z")
    const { xml, fiscalTotals } = buildInvoiceEcfXml(testIssuer, invoice, now)

    const doc = parseAndValidateXml(xml)

    if (getElementText(doc, "TipoeCF") !== "31") throw new Error("TipoeCF must be 31")
    if (getElementText(doc, "eNCF") !== "E310000000002") throw new Error("eNCF must match")
    if (getElementText(doc, "FechaVencimientoSecuencia") !== "31-12-2028") {
        throw new Error(`FechaVencimientoSecuencia expected 31-12-2028, got ${getElementText(doc, "FechaVencimientoSecuencia")}`)
    }
    if (getElementText(doc, "RNCComprador") !== "131880681") throw new Error("RNCComprador mismatch")
    if (getElementText(doc, "RazonSocialComprador") !== "Transportes del Caribe SRL") throw new Error("RazonSocialComprador mismatch")
    if (getElementText(doc, "TipoPago") !== "2") throw new Error("TipoPago must be 2 for credit")
    if (getElementText(doc, "TerminoPago") !== "A credito") throw new Error("TerminoPago must be 'A credito'")
    if (getElementText(doc, "FechaLimitePago") !== "15-12-2026") throw new Error("FechaLimitePago mismatch")

    const gravado = Number(getElementText(doc, "MontoGravadoTotal"))
    const exento = Number(getElementText(doc, "MontoExento"))
    const itbis = Number(getElementText(doc, "TotalITBIS"))
    const total = Number(getElementText(doc, "MontoTotal"))

    // Line 1: 4 * 2500 - 200 = 9800. Shipping appended as line 2 named 'Envío': 500 exempt.
    if (gravado !== 9800.0) throw new Error(`MontoGravadoTotal expected 9800, got ${gravado}`)
    if (exento !== 500.0) throw new Error(`MontoExento expected 500, got ${exento}`)
    if (itbis !== 1764.0) throw new Error(`TotalITBIS expected 1764, got ${itbis}`)
    if (total !== 12064.0) throw new Error(`MontoTotal expected 12064, got ${total}`)

    // Check that appended shipping line is named "Envío"
    const items = doc.getElementsByTagName("Item")
    if (items.length !== 2) throw new Error(`Expected 2 items, got ${items.length}`)
    const shippingItemName = items[1].getElementsByTagName("NombreItem")[0].textContent
    if (shippingItemName !== "Envío") {
        throw new Error(`Appended shipping line expected to be named 'Envío', got '${shippingItemName}'`)
    }

    if (Math.abs(gravado + exento + itbis - total) > 0.001) {
        throw new Error("MontoGravadoTotal + MontoExento + TotalITBIS must equal MontoTotal")
    }

    if (fiscalTotals.totalAmount !== 12064.0) throw new Error("fiscalTotals total mismatch")

    assertElementOrder(doc, "ECF", CANONICAL_ORDERS.ECF)
    assertElementOrder(doc, "Encabezado", CANONICAL_ORDERS.Encabezado)
    assertElementOrder(doc, "IdDoc", CANONICAL_ORDERS.IdDoc)
    assertElementOrder(doc, "Emisor", CANONICAL_ORDERS.Emisor)
    assertElementOrder(doc, "Comprador", CANONICAL_ORDERS.Comprador)
    assertElementOrder(doc, "Totales", CANONICAL_ORDERS.Totales)
    assertElementOrder(doc, "Item", CANONICAL_ORDERS.Item)
})

// Case (c): E34 credit note
runCheck("Case (c): E34 credit note referencing original invoice", () => {
    const note: CreditNoteSnapshot = {
        ecfType: "E34",
        encf: "E340000000001",
        issuedAt: new Date("2026-11-15T16:00:00Z"),
        original: {
            encf: "E310000000002",
            issuedAt: "2026-10-01", // 45 days elapsed -> IndicadorNotaCredito = 1 (> 30 days)
        },
        reason: {
            code: 1, // Anula el documento anterior
            text: "Devolución de mercancía por garantía",
        },
        buyer: {
            rnc: "131880681",
            name: "Transportes del Caribe SRL",
        },
        lines: [
            {
                name: "Amortiguador Delantero Heavy Duty",
                quantity: 1,
                unitPrice: 2500,
                taxable: true,
                isService: false,
            },
        ],
    }

    const now = new Date("2026-11-15T16:00:00Z")
    const { xml, fiscalTotals } = buildCreditNoteEcfXml(testIssuer, note, now)

    const doc = parseAndValidateXml(xml)

    if (getElementText(doc, "TipoeCF") !== "34") throw new Error("TipoeCF must be 34")
    if (getElementText(doc, "eNCF") !== "E340000000001") throw new Error("eNCF must match")
    if (getElementText(doc, "IndicadorNotaCredito") !== "1") {
        throw new Error(`IndicadorNotaCredito expected 1 (>30 days), got ${getElementText(doc, "IndicadorNotaCredito")}`)
    }
    if (getElementText(doc, "NCFModificado") !== "E310000000002") throw new Error("NCFModificado mismatch")
    if (getElementText(doc, "FechaNCFModificado") !== "01-10-2026") throw new Error("FechaNCFModificado mismatch")
    if (getElementText(doc, "CodigoModificacion") !== "1") throw new Error("CodigoModificacion mismatch")
    if (getElementText(doc, "RazonModificacion") !== "Devolución de mercancía por garantía") {
        throw new Error("RazonModificacion mismatch")
    }

    const gravado = Number(getElementText(doc, "MontoGravadoTotal"))
    const itbis = Number(getElementText(doc, "TotalITBIS"))
    const total = Number(getElementText(doc, "MontoTotal"))

    if (gravado !== 2500.0) throw new Error(`MontoGravadoTotal expected 2500, got ${gravado}`)
    if (itbis !== 450.0) throw new Error(`TotalITBIS expected 450, got ${itbis}`)
    if (total !== 2950.0) throw new Error(`MontoTotal expected 2950, got ${total}`)

    if (Math.abs(gravado + itbis - total) > 0.001) {
        throw new Error("Totals must balance")
    }

    if (fiscalTotals.totalAmount !== 2950.0) throw new Error("fiscalTotals mismatch")

    assertElementOrder(doc, "ECF", CANONICAL_ORDERS.ECF)
    assertElementOrder(doc, "Encabezado", CANONICAL_ORDERS.Encabezado)
    assertElementOrder(doc, "IdDoc", CANONICAL_ORDERS.IdDoc)
    assertElementOrder(doc, "Emisor", CANONICAL_ORDERS.Emisor)
    assertElementOrder(doc, "Comprador", CANONICAL_ORDERS.Comprador)
    assertElementOrder(doc, "Totales", CANONICAL_ORDERS.Totales)
    assertElementOrder(doc, "Item", CANONICAL_ORDERS.Item)
    assertElementOrder(doc, "InformacionReferencia", CANONICAL_ORDERS.InformacionReferencia)
})

// Case (d): Rejections for invalid inputs and unbalanced totals without discount
runCheck("Case (d): Reject unbalanced document or invalid buyer on E31", () => {
    let rejectedMissingBuyer = false
    try {
        buildInvoiceEcfXml(
            testIssuer,
            {
                ecfType: "E31",
                encf: "E310000000003",
                sequenceExpiresOn: "2028-12-31",
                issuedAt: new Date(),
                buyer: { rnc: "" }, // Missing buyer for E31
                lines: [{ name: "Pieza", quantity: 1, unitPrice: 100, taxable: true, isService: false }],
                payment: { method: "CASH" },
            },
            new Date()
        )
    } catch {
        rejectedMissingBuyer = true
    }
    if (!rejectedMissingBuyer) throw new Error("Expected failure for E31 without buyer RNC")

    let rejectedUnbalanced = false
    try {
        buildInvoiceEcfXml(
            testIssuer,
            {
                ecfType: "E32",
                encf: "E320000000002",
                issuedAt: new Date(),
                lines: [{ name: "Pieza", quantity: 1, unitPrice: 100, taxable: true, isService: false }],
                payment: { method: "CASH" },
                totals: {
                    total: 500, // Impossibly mismatched total without discount
                },
            },
            new Date()
        )
    } catch {
        rejectedUnbalanced = true
    }
    if (!rejectedUnbalanced) throw new Error("Expected failure for mismatched stored totals without discount")
})

// Case (e): Discounted E32 with mixed lines (Finding 1)
// Verifies:
// 1. Prorating proportional to gross (qty * price).
// 2. Remainder absorbed by the LAST line so sum(discounts) === discount exactly.
// 3. ITBIS computed on the discounted taxable base.
// 4. MontoItem = round2(qty * price - DescuentoMonto).
// 5. Stored totals difference allowed (fiscalTotals returned to caller).
runCheck("Case (e): Discounted E32 with mixed lines and remainder absorption", () => {
    // 3 lines with gross amounts:
    // Line 1: 1 * 1000 = 1000 (taxable)
    // Line 2: 1 * 1000 = 1000 (exempt)
    // Line 3: 1 * 1000 = 1000 (taxable)
    // Total gross = 3000.
    // Global discount = 100.
    // Line 1: round2(100 * 1000 / 3000) = 33.33
    // Line 2: round2(100 * 1000 / 3000) = 33.33
    // Allocated so far = 66.66
    // Line 3 (last): 100 - 66.66 = 33.34 (absorbs 0.01 remainder!)
    // MontoItem 1: 1000 - 33.33 = 966.67
    // MontoItem 2: 1000 - 33.33 = 966.67
    // MontoItem 3: 1000 - 33.34 = 966.66
    // Taxable base = 966.67 + 966.66 = 1933.33
    // ITBIS = round2(1933.33 * 0.18) = round2(347.9994) = 348.00
    // Exempt base = 966.67
    // Total = 1933.33 + 966.67 + 348.00 = 3248.00
    // Note: App formula would calculate total = 3000 + 360 - 100 = 3260.00 (ITBIS before discount).
    // The mapper must ignore stored total when discount is present and return fiscalTotals.
    const invoice: InvoiceSnapshot = {
        ecfType: "E32",
        encf: "E320000000003",
        issuedAt: new Date("2026-11-15T17:00:00Z"),
        lines: [
            { name: "Servicio A", quantity: 1, unitPrice: 1000, taxable: true, isService: true },
            { name: "Servicio B", quantity: 1, unitPrice: 1000, taxable: false, isService: true },
            { name: "Servicio C", quantity: 1, unitPrice: 1000, taxable: true, isService: true },
        ],
        discount: 100,
        payment: { method: "CASH" },
        totals: {
            total: 3260, // Old app calculation (ITBIS before discount)
        },
    }

    const now = new Date("2026-11-15T17:00:00Z")
    const { xml, fiscalTotals } = buildInvoiceEcfXml(testIssuer, invoice, now)
    const doc = parseAndValidateXml(xml)

    // Verify prorating on items
    const items = doc.getElementsByTagName("Item")
    if (items.length !== 3) throw new Error(`Expected 3 items, got ${items.length}`)

    const d1 = Number(items[0].getElementsByTagName("DescuentoMonto")[0].textContent)
    const d2 = Number(items[1].getElementsByTagName("DescuentoMonto")[0].textContent)
    const d3 = Number(items[2].getElementsByTagName("DescuentoMonto")[0].textContent)

    if (d1 !== 33.33) throw new Error(`Line 1 discount expected 33.33, got ${d1}`)
    if (d2 !== 33.33) throw new Error(`Line 2 discount expected 33.33, got ${d2}`)
    if (d3 !== 33.34) throw new Error(`Line 3 discount expected 33.34 (remainder absorbed), got ${d3}`)
    if (d1 + d2 + d3 !== 100.0) throw new Error(`Sum of line discounts must equal 100.00, got ${d1 + d2 + d3}`)

    const m1 = Number(items[0].getElementsByTagName("MontoItem")[0].textContent)
    const m2 = Number(items[1].getElementsByTagName("MontoItem")[0].textContent)
    const m3 = Number(items[2].getElementsByTagName("MontoItem")[0].textContent)

    if (m1 !== 966.67) throw new Error(`Line 1 MontoItem expected 966.67, got ${m1}`)
    if (m2 !== 966.67) throw new Error(`Line 2 MontoItem expected 966.67, got ${m2}`)
    if (m3 !== 966.66) throw new Error(`Line 3 MontoItem expected 966.66, got ${m3}`)

    // Header totals
    const gravado = Number(getElementText(doc, "MontoGravadoTotal"))
    const exento = Number(getElementText(doc, "MontoExento"))
    const itbis = Number(getElementText(doc, "TotalITBIS"))
    const montoTotal = Number(getElementText(doc, "MontoTotal"))

    if (gravado !== 1933.33) throw new Error(`MontoGravadoTotal expected 1933.33, got ${gravado}`)
    if (exento !== 966.67) throw new Error(`MontoExento expected 966.67, got ${exento}`)
    if (itbis !== 348.0) throw new Error(`TotalITBIS expected 348.00, got ${itbis}`)
    if (montoTotal !== 3248.0) throw new Error(`MontoTotal expected 3248.00, got ${montoTotal}`)

    // Verify returned fiscalTotals
    if (fiscalTotals.taxableAmount !== 1933.33) throw new Error("fiscalTotals taxable mismatch")
    if (fiscalTotals.exemptAmount !== 966.67) throw new Error("fiscalTotals exempt mismatch")
    if (fiscalTotals.itbisAmount !== 348.0) throw new Error("fiscalTotals itbis mismatch")
    if (fiscalTotals.totalAmount !== 3248.0) throw new Error("fiscalTotals total mismatch")
})

// Case (f): Precision consistency with quantity 1.255 and price 333.3333 (Finding 3)
// Verifies:
// 1. Quantity rounded to 2 decimals first -> 1.26
// 2. Unit price rounded to 4 decimals -> 333.3333
// 3. MontoItem = round2(1.26 * 333.3333) = 420.00
// 4. Line by line XML self-consistency
runCheck("Case (f): Precision consistency with quantity 1.255 and price 333.3333", () => {
    const invoice: InvoiceSnapshot = {
        ecfType: "E32",
        encf: "E320000000004",
        issuedAt: new Date("2026-11-15T18:00:00Z"),
        lines: [
            {
                name: "Fluido Refrigerante R134a",
                quantity: 1.255,
                unitPrice: 333.3333,
                taxable: true,
                isService: false,
                unitMeasure: "43",
            },
        ],
        payment: { method: "CASH" },
    }

    const now = new Date("2026-11-15T18:00:00Z")
    const { xml, fiscalTotals } = buildInvoiceEcfXml(testIssuer, invoice, now)
    const doc = parseAndValidateXml(xml)

    const items = doc.getElementsByTagName("Item")
    if (items.length !== 1) throw new Error(`Expected 1 item, got ${items.length}`)

    const qtyText = items[0].getElementsByTagName("CantidadItem")[0].textContent
    const priceText = items[0].getElementsByTagName("PrecioUnitarioItem")[0].textContent
    const montoText = items[0].getElementsByTagName("MontoItem")[0].textContent

    if (qtyText !== "1.26") throw new Error(`CantidadItem expected 1.26, got ${qtyText}`)
    if (priceText !== "333.3333") throw new Error(`PrecioUnitarioItem expected 333.3333, got ${priceText}`)
    if (montoText !== "420.00") throw new Error(`MontoItem expected 420.00, got ${montoText}`)

    // Math check: 1.26 * 333.3333 = 419.999958 -> rounded to 420.00
    const gravado = Number(getElementText(doc, "MontoGravadoTotal"))
    const itbis = Number(getElementText(doc, "TotalITBIS"))
    const total = Number(getElementText(doc, "MontoTotal"))

    if (gravado !== 420.0) throw new Error(`MontoGravadoTotal expected 420.00, got ${gravado}`)
    if (itbis !== 75.6) throw new Error(`TotalITBIS expected 75.60, got ${itbis}`)
    if (total !== 495.6) throw new Error(`MontoTotal expected 495.60, got ${total}`)

    if (fiscalTotals.totalAmount !== 495.6) throw new Error("fiscalTotals mismatch")
})

// Case (g): Exempt-only document omits TotalITBIS (Finding 6)
// Verifies:
// Follows accepted certification rows (e.g. case 133339749E430000000011, 133339749E330000000001):
// A document with ONLY exempt lines must NOT emit <TotalITBIS>.
runCheck("Case (g): Exempt-only document omits TotalITBIS", () => {
    const invoice: InvoiceSnapshot = {
        ecfType: "E32",
        encf: "E320000000005",
        issuedAt: new Date("2026-11-15T19:00:00Z"),
        lines: [
            {
                name: "Servicio Exento de Mantenimiento",
                quantity: 1,
                unitPrice: 700,
                taxable: false,
                isService: true,
            },
        ],
        payment: { method: "TRANSFER" },
    }

    const now = new Date("2026-11-15T19:00:00Z")
    const { xml, fiscalTotals } = buildInvoiceEcfXml(testIssuer, invoice, now)
    const doc = parseAndValidateXml(xml)

    if (getElementText(doc, "MontoExento") !== "700.00") throw new Error("MontoExento expected 700.00")
    if (getElementText(doc, "MontoTotal") !== "700.00") throw new Error("MontoTotal expected 700.00")
    if (getElementText(doc, "TotalITBIS") !== null) {
        throw new Error("Exempt-only document must omit <TotalITBIS> (per accepted certification submissions)")
    }
    if (getElementText(doc, "MontoGravadoTotal") !== null) {
        throw new Error("Exempt-only document must omit <MontoGravadoTotal>")
    }

    if (fiscalTotals.itbisAmount !== 0) throw new Error("fiscalTotals itbisAmount expected 0")
    if (fiscalTotals.totalAmount !== 700.0) throw new Error("fiscalTotals totalAmount expected 700.00")
})

// Case (h): Credit payment without dueDate throws PAYMENT_DUE_DATE_REQUIRED (Finding 5)
runCheck("Case (h): Credit payment requires dueDate", () => {
    let threwDueDate = false
    try {
        buildInvoiceEcfXml(
            testIssuer,
            {
                ecfType: "E32",
                encf: "E320000000006",
                issuedAt: new Date(),
                lines: [{ name: "Pieza", quantity: 1, unitPrice: 100, taxable: true, isService: false }],
                payment: { method: "CREDIT" }, // Missing dueDate
            },
            new Date()
        )
    } catch (err) {
        if (err instanceof IssuanceError && err.code === "PAYMENT_DUE_DATE_REQUIRED") {
            threwDueDate = true
        }
    }
    if (!threwDueDate) throw new Error("Expected PAYMENT_DUE_DATE_REQUIRED when dueDate is missing for credit")
})

// Case (i): Discount exceeding gross sum throws DISCOUNT_EXCEEDS_ITEMS (Finding 2)
runCheck("Case (i): Discount exceeding items gross sum throws DISCOUNT_EXCEEDS_ITEMS", () => {
    let threwExceeds = false
    try {
        computeEcfTotals(
            [{ name: "Pieza", quantity: 1, unitPrice: 100, taxable: true, isService: false }],
            { discount: 150 }
        )
    } catch (err) {
        if (err instanceof IssuanceError && err.code === "DISCOUNT_EXCEEDS_ITEMS") {
            threwExceeds = true
        }
    }
    if (!threwExceeds) throw new Error("Expected DISCOUNT_EXCEEDS_ITEMS when discount > grossSum")
})

// Case (j): Tiny last line where remainder exceeds line gross throws DISCOUNT_ALLOCATION_INVALID
// When earlier lines round down (50.66 * 3 = 151.98 of 152.00), the remainder left for the last
// line (0.02) exceeds its gross amount (0.01), triggering DISCOUNT_ALLOCATION_INVALID.
runCheck("Case (j): Tiny last line where remainder exceeds line gross throws DISCOUNT_ALLOCATION_INVALID", () => {
    let threwInvalid = false
    let lineReported = false
    try {
        computeEcfTotals(
            [
                { name: "Pieza A", quantity: 1, unitPrice: 100, taxable: true, isService: false },
                { name: "Pieza B", quantity: 1, unitPrice: 100, taxable: true, isService: false },
                { name: "Pieza C", quantity: 1, unitPrice: 100, taxable: true, isService: false },
                { name: "Pieza D", quantity: 1, unitPrice: 0.01, taxable: true, isService: false },
            ],
            { discount: 152 }
        )
    } catch (err) {
        if (err instanceof IssuanceError && err.code === "DISCOUNT_ALLOCATION_INVALID") {
            threwInvalid = true
            lineReported = err.message.includes("Line item 4")
        }
    }
    if (!threwInvalid) {
        throw new Error("Expected DISCOUNT_ALLOCATION_INVALID when discount remainder exceeds tiny last line gross")
    }
    if (!lineReported) {
        throw new Error("Expected DISCOUNT_ALLOCATION_INVALID error message to contain line number 4")
    }
})

// Case (k): assertStoredTotalsMatch rejects mismatched stored totals in credit notes
runCheck("Case (k): assertStoredTotalsMatch rejects mismatched stored totals in credit notes", () => {
    let threwMismatch = false
    try {
        buildCreditNoteEcfXml(
            testIssuer,
            {
                ecfType: "E34",
                encf: "E340000000002",
                issuedAt: new Date("2026-11-15T16:00:00Z"),
                original: { encf: "E310000000002", issuedAt: "2026-10-01" },
                reason: { code: 1, text: "Anulación por error" },
                lines: [{ name: "Pieza", quantity: 1, unitPrice: 100, taxable: true, isService: false }],
                totals: { total: 999 }, // Mismatched stored total (computed total is 118.00)
            },
            new Date("2026-11-15T16:00:00Z")
        )
    } catch (err) {
        if (err instanceof IssuanceError && err.code === "TOTALS_MISMATCH") {
            threwMismatch = true
        }
    }
    if (!threwMismatch) throw new Error("Expected TOTALS_MISMATCH when credit note stored total differs")
})

console.log(`\nSummary: ${passedCount} passed, ${failedCount} failed`)
if (failedCount > 0) {
    process.exit(1)
} else {
    process.exit(0)
}
