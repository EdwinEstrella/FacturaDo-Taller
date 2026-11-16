// Functional checks for invoice electronic issuance (ECF-I2).
// Run with: npx tsx scripts/check-invoice-issuance.ts
// Pure checks: no network, no database calls, deterministic exit code.

import {
    computeEcfTotals,
    computeNoReceiptTotals,
    totalsDrift,
} from "../lib/fiscal/issuance/totals"
import {
    buyerFiscalId,
    isServiceProduct,
    resolveEcfType,
} from "../lib/fiscal/issuance/buyer"
import {
    assertIssuerComplete,
    buildInvoiceSnapshotInput,
    CREDIT_DUE_DAYS,
} from "../lib/fiscal/issuance/invoice-issuance"
import { buildInvoiceEcfXml } from "../lib/fiscal/issuance/mapper"
import { IssuanceError } from "../lib/fiscal/issuance/errors"
import {
    PAYMENT_METHODS,
    isPaymentMethod,
    type InvoiceLineSnapshot,
    type InvoiceSnapshot,
    type IssuerSnapshot,
} from "../lib/fiscal/issuance/types"

let passedCount = 0
let failedCount = 0

function runTest(name: string, fn: () => void) {
    try {
        fn()
        console.log(`[PASS] ${name}`)
        passedCount++
    } catch (error) {
        console.error(`[FAIL] ${name}:`, error instanceof Error ? error.message : error)
        failedCount++
    }
}

function assertEqual<T>(actual: T, expected: T, msg: string) {
    if (actual !== expected) {
        throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)}`)
    }
}

console.log("=== Checking Invoice Issuance (ECF-I2) ===\n")

// ---------------------------------------------------------------------------
// 1. buyerFiscalId & resolveEcfType tests
// ---------------------------------------------------------------------------

runTest("buyerFiscalId: strips dashes, returns 9-digit RNC or 11-digit cédula", () => {
    assertEqual(buyerFiscalId({ rnc: "131-23456-7" }), "131234567", "9-digit RNC with dashes")
    assertEqual(buyerFiscalId({ cedula: "001-1234567-8" }), "00112345678", "11-digit cédula with dashes")
    assertEqual(buyerFiscalId({ rnc: "123", cedula: "456" }), null, "Short digits return null")
    assertEqual(buyerFiscalId({ rnc: "ABC-DEF" }), null, "Letters only return null")
    assertEqual(buyerFiscalId(null), null, "Null client returns null")
    assertEqual(buyerFiscalId({ rnc: "12345", cedula: "402-2345678-9" }), "40223456789", "Invalid RNC falls back to valid cédula")
})

runTest("resolveEcfType: 9-digit RNC with dashes resolves to E31", () => {
    const client = { rnc: "131-23456-7", cedula: null }
    assertEqual(resolveEcfType(client), "E31", "9-digit RNC with dashes should be E31")
})

runTest("resolveEcfType: 11-digit cédula resolves to E31", () => {
    const client = { rnc: null, cedula: "001-1234567-8" }
    assertEqual(resolveEcfType(client), "E31", "11-digit cédula should be E31")
})

runTest("resolveEcfType: empty / short identifier resolves to E32", () => {
    assertEqual(resolveEcfType(null), "E32", "null client should be E32")
    assertEqual(resolveEcfType({ rnc: "", cedula: "" }), "E32", "empty strings should be E32")
    assertEqual(resolveEcfType({ rnc: "123", cedula: "456" }), "E32", "short digits should be E32")
    assertEqual(resolveEcfType({ rnc: "ABC-DEF", cedula: null }), "E32", "letters only should be E32")
})

runTest("resolveEcfType: invalid RNC but valid cédula resolves to E31", () => {
    const client = { rnc: "12345", cedula: "402-2345678-9" }
    assertEqual(resolveEcfType(client), "E31", "Invalid RNC but valid 11-digit cédula should be E31")
})

runTest("resolveEcfType: valid RNC takes precedence over invalid cédula", () => {
    const client = { rnc: "101-00000-5", cedula: "000" }
    assertEqual(resolveEcfType(client), "E31", "Valid RNC should resolve to E31")
})

// ---------------------------------------------------------------------------
// 2. buildInvoiceSnapshotInput tests
// ---------------------------------------------------------------------------

runTest("buildInvoiceSnapshotInput: service product becomes exempt (taxable = false)", () => {
    const prod1 = { isService: false, category: "ARTICULO" }
    const prod2 = { isService: true, category: "SERVICIO" }
    const prod3 = { isService: false, category: "SERVICIO" }

    const snapshot = buildInvoiceSnapshotInput({
        items: [
            {
                name: "Filtro de Aceite",
                quantity: 2,
                unitPrice: 450,
                isService: isServiceProduct(prod1),
            },
            {
                name: "Mano de obra",
                quantity: 1,
                unitPrice: 800,
                isService: isServiceProduct(prod2),
            },
            {
                name: "Diagnóstico Computarizado",
                quantity: 1,
                unitPrice: 1200,
                isService: isServiceProduct(prod3),
            },
        ],
        payment: { method: "CASH" },
        shipping: 0,
        discount: 0,
        issuedAt: new Date("2026-11-16T12:00:00.000Z"),
    })

    const lines = snapshot.invoice.lines
    assertEqual(lines.length, 3, "Expected 3 lines")

    // Normal product
    assertEqual(lines[0].taxable, true, "Product line should be taxable")
    assertEqual(lines[0].isService, false, "Product line isService should be false")
    assertEqual(lines[0].quantity, 2, "Product line quantity")
    assertEqual(lines[0].unitPrice, 450, "Product line unitPrice")

    // Service product (isService = true)
    assertEqual(lines[1].taxable, false, "Service line should be exempt (taxable=false)")
    assertEqual(lines[1].isService, true, "Service line isService should be true")

    // Service by category ("SERVICIO") via isServiceProduct helper
    assertEqual(lines[2].taxable, false, "Category SERVICIO should be exempt (taxable=false)")
    assertEqual(lines[2].isService, true, "Category SERVICIO isService should be true")
})

runTest("buildInvoiceSnapshotInput: invalid RNC never reaches snapshot buyer (becomes null)", () => {
    const snapshot = buildInvoiceSnapshotInput({
        items: [{ name: "Batería", quantity: 1, unitPrice: 5000, isService: false }],
        client: {
            name: "Cliente Casual",
            rnc: "12345", // invalid 5 digits
            cedula: "ABC", // invalid
        },
        payment: { method: "CASH" },
        shipping: 0,
        discount: 0,
        issuedAt: new Date("2026-11-16T12:00:00.000Z"),
    })

    assertEqual(snapshot.ecfType, "E32", "Invalid buyer ID should result in E32")
    assertEqual(snapshot.invoice.buyer?.rnc, null, "Invalid RNC must never be set on buyer snapshot")
    assertEqual(snapshot.invoice.buyer?.name, "Cliente Casual", "Buyer name preserved")
})

runTest("buildInvoiceSnapshotInput: CREDIT payment sets dueDate = issuedAt + 30 days", () => {
    const issuedAt = new Date("2026-11-16T12:00:00.000Z")
    const snapshot = buildInvoiceSnapshotInput({
        items: [{ name: "Batería", quantity: 1, unitPrice: 5000, isService: false }],
        payment: { method: "CREDIT" },
        shipping: 0,
        discount: 0,
        issuedAt,
    })

    assertEqual(CREDIT_DUE_DAYS, 30, "CREDIT_DUE_DAYS constant must be 30")
    assertEqual(snapshot.invoice.payment.method, "CREDIT", "Payment method")

    const expectedDue = new Date(issuedAt.getTime() + 30 * 86_400_000).toISOString()
    assertEqual(snapshot.invoice.payment.dueDate, expectedDue, "Credit due date should be issuedAt + 30 days")
})

runTest("buildInvoiceSnapshotInput: non-CREDIT payment has null dueDate", () => {
    const snapshot = buildInvoiceSnapshotInput({
        items: [{ name: "Batería", quantity: 1, unitPrice: 5000, isService: false }],
        payment: { method: "CASH" },
        shipping: 0,
        discount: 0,
        issuedAt: new Date("2026-11-16T12:00:00.000Z"),
    })

    assertEqual(snapshot.invoice.payment.method, "CASH", "Payment method")
    assertEqual(snapshot.invoice.payment.dueDate, null, "Non-credit payment should have null dueDate")
})

runTest("buildInvoiceSnapshotInput: shipping and discount carried properly", () => {
    const snapshot = buildInvoiceSnapshotInput({
        items: [{ name: "Goma 195/65R15", quantity: 4, unitPrice: 3500, isService: false }],
        client: {
            name: "Transportes Dominicanos",
            rnc: "1-31-00000-1",
            address: "Av. Luperón #50",
            phone: "809-555-0101",
            email: "admin@transdom.com",
        },
        payment: { method: "CASH" },
        shipping: 500,
        discount: 1000,
        issuedAt: new Date("2026-11-16T12:00:00.000Z"),
    })

    assertEqual(snapshot.invoice.shipping, 500, "Shipping cost carried")
    assertEqual(snapshot.invoice.discount, 1000, "Discount carried")
    assertEqual(snapshot.ecfType, "E31", "E-CF type resolved from client")
    assertEqual(snapshot.invoice.buyer?.rnc, "131000001", "Buyer RNC cleaned")
    assertEqual(snapshot.invoice.buyer?.name, "Transportes Dominicanos", "Buyer name carried")
    assertEqual(snapshot.invoice.buyer?.address, "Av. Luperón #50", "Buyer address carried")
})

// ---------------------------------------------------------------------------
// 3. computeNoReceiptTotals tests (discount capped at items gross, shipping not discounted)
// ---------------------------------------------------------------------------

runTest("computeNoReceiptTotals: discount capped at items gross, shipping not discounted", () => {
    // Case 1: discount (1500) exceeds itemsGross (1000) -> capped at 1000, shipping (200) not discounted -> total = 200
    const res1 = computeNoReceiptTotals(1000, { shipping: 200, discount: 1500 })
    assertEqual(res1.subtotal, 1000, "Subtotal is itemsGross")
    assertEqual(res1.tax, 0, "No receipt ITBIS is strictly 0")
    assertEqual(res1.discount, 1000, "Discount capped at items gross")
    assertEqual(res1.shipping, 200, "Shipping untouched")
    assertEqual(res1.total, 200, "Total = 1000 - 1000 + 200 = 200")

    // Case 2: standard discount
    const res2 = computeNoReceiptTotals(1000, { shipping: 150, discount: 100 })
    assertEqual(res2.subtotal, 1000, "Subtotal")
    assertEqual(res2.tax, 0, "Tax")
    assertEqual(res2.discount, 100, "Discount")
    assertEqual(res2.shipping, 150, "Shipping")
    assertEqual(res2.total, 1050, "Total = 1000 - 100 + 150 = 1050")
})

// ---------------------------------------------------------------------------
// 4. assertIssuerComplete validation tests
// ---------------------------------------------------------------------------

runTest("assertIssuerComplete: complete issuer passes validation", () => {
    const issuer: IssuerSnapshot = {
        rnc: "131234567",
        legalName: "Taller Mecánico Dominicano SRL",
        address: "Av. 27 de Febrero #100",
    }
    assertIssuerComplete(issuer)
})

runTest("assertIssuerComplete: missing RNC throws ISSUER_INCOMPLETE", () => {
    const issuer = {
        rnc: "",
        legalName: "Taller SRL",
        address: "Santo Domingo",
    }
    try {
        assertIssuerComplete(issuer)
        throw new Error("Should have thrown ISSUER_INCOMPLETE")
    } catch (e) {
        if (!(e instanceof IssuanceError) || e.code !== "ISSUER_INCOMPLETE") throw e
        if (!e.message.includes("RNC")) throw new Error("Expected missing RNC in error message")
    }
})

runTest("assertIssuerComplete: missing legalName and address throws ISSUER_INCOMPLETE listing both", () => {
    const issuer = {
        rnc: "131234567",
        legalName: "",
        address: "",
    }
    try {
        assertIssuerComplete(issuer)
        throw new Error("Should have thrown ISSUER_INCOMPLETE")
    } catch (e) {
        if (!(e instanceof IssuanceError) || e.code !== "ISSUER_INCOMPLETE") throw e
        if (!e.message.includes("Razón social") || !e.message.includes("Dirección")) {
            throw new Error(`Expected both fields in message, got: ${e.message}`)
        }
    }
})

// ---------------------------------------------------------------------------
// 5. Dry-run XML for E31 without buyer name fails before reservation
// ---------------------------------------------------------------------------

runTest("Dry-run XML: E31 snapshot without buyer name fails before reservation", () => {
    const issuer: IssuerSnapshot = {
        rnc: "131234567",
        legalName: "Taller SRL",
        address: "Av. Central #1",
    }

    const dryRunInvoice: InvoiceSnapshot = {
        ecfType: "E31",
        encf: "E310000000001",
        sequenceExpiresOn: "2026-12-31",
        issuedAt: new Date("2026-11-16T12:00:00.000Z"),
        buyer: {
            rnc: "101000005",
            name: null, // Missing buyer name on E31
        },
        lines: [
            {
                name: "Repuesto",
                quantity: 1,
                unitPrice: 1000,
                taxable: true,
                isService: false,
            },
        ],
        payment: { method: "CASH" },
        shipping: 0,
        discount: 0,
    }

    try {
        buildInvoiceEcfXml(issuer, dryRunInvoice, new Date())
        throw new Error("Should have thrown BUYER_NAME_REQUIRED")
    } catch (e) {
        if (!(e instanceof IssuanceError) || e.code !== "BUYER_NAME_REQUIRED") {
            throw new Error(`Expected BUYER_NAME_REQUIRED, got: ${String(e)}`)
        }
    }
})

// ---------------------------------------------------------------------------
// 6. Totals example: 1,000 taxable − 100 discount → ITBIS 162 / total 1,062
// ---------------------------------------------------------------------------

runTest("computeEcfTotals: 1,000 taxable − 100 discount → ITBIS 162 / total 1,062", () => {
    const lines: InvoiceLineSnapshot[] = [
        {
            name: "Servicio Técnico o Repuesto",
            quantity: 1,
            unitPrice: 1000,
            taxable: true,
            isService: false,
        },
    ]

    const result = computeEcfTotals(lines, {
        discount: 100,
        shipping: 0,
    })

    assertEqual(result.taxableAmount, 900, "Discounted taxable base")
    assertEqual(result.exemptAmount, 0, "Exempt amount")
    assertEqual(result.itbisAmount, 162, "ITBIS on discounted base")
    assertEqual(result.totalAmount, 1062, "Charged total")
})

runTest("computeEcfTotals: shipping with discount ensures shipping is exempt and not discounted", () => {
    const lines: InvoiceLineSnapshot[] = [
        {
            name: "Aceite Motor",
            quantity: 1,
            unitPrice: 1000,
            taxable: true,
            isService: false,
        },
    ]

    const result = computeEcfTotals(lines, {
        discount: 100,
        shipping: 200,
    })

    assertEqual(result.taxableAmount, 900, "Taxable base")
    assertEqual(result.exemptAmount, 200, "Shipping is exempt")
    assertEqual(result.itbisAmount, 162, "ITBIS")
    assertEqual(result.totalAmount, 1262, "Total with shipping")
})

// ---------------------------------------------------------------------------
// 7. totalsDrift tests (0.01 tolerance)
// ---------------------------------------------------------------------------

runTest("totalsDrift: exact match returns false (no drift)", () => {
    assertEqual(totalsDrift({ total: 1000, tax: 180 }, { total: 1000, tax: 180 }), false, "Exact match")
})

runTest("totalsDrift: within 0.01 tolerance returns false (no drift)", () => {
    assertEqual(totalsDrift({ total: 1000.009, tax: 180 }, { total: 1000, tax: 180 }), false, "Total diff <= 0.01")
    assertEqual(totalsDrift({ total: 1000, tax: 180.008 }, { total: 1000, tax: 180 }), false, "Tax diff <= 0.01")
    assertEqual(totalsDrift({ total: 999.991, tax: 179.995 }, { total: 1000, tax: 180 }), false, "Both diff <= 0.01")
})

runTest("totalsDrift: difference > 0.01 on total returns true (drift)", () => {
    assertEqual(totalsDrift({ total: 1000.02, tax: 180 }, { total: 1000, tax: 180 }), true, "Total diff 0.02")
    assertEqual(totalsDrift({ total: 999.98, tax: 180 }, { total: 1000, tax: 180 }), true, "Total diff -0.02")
})

runTest("totalsDrift: difference > 0.01 on tax returns true (drift)", () => {
    assertEqual(totalsDrift({ total: 1000, tax: 180.02 }, { total: 1000, tax: 180 }), true, "Tax diff 0.02")
    assertEqual(totalsDrift({ total: 1000, tax: 179.98 }, { total: 1000, tax: 180 }), true, "Tax diff -0.02")
})

runTest("totalsDrift: handles nullish / string values gracefully", () => {
    assertEqual(totalsDrift({ total: "1000.00", tax: "180.00" }, { total: 1000, tax: 180 }), false, "String numbers")
    assertEqual(totalsDrift({ total: null, tax: undefined }, { total: 0, tax: 0 }), false, "Nullish vs zero")
    assertEqual(totalsDrift({ total: "1005.00", tax: 0 }, { total: 1000, tax: 0 }), true, "Diff with string")
})

// ---------------------------------------------------------------------------
// 8. PAYMENT_METHODS constant and isPaymentMethod type guard
// ---------------------------------------------------------------------------

runTest("PAYMENT_METHODS: exports exactly CASH, TRANSFER, CARD, CREDIT", () => {
    assertEqual(PAYMENT_METHODS.length, 4, "Array length must be 4")
    assertEqual(PAYMENT_METHODS[0], "CASH", "Index 0 is CASH")
    assertEqual(PAYMENT_METHODS[1], "TRANSFER", "Index 1 is TRANSFER")
    assertEqual(PAYMENT_METHODS[2], "CARD", "Index 2 is CARD")
    assertEqual(PAYMENT_METHODS[3], "CREDIT", "Index 3 is CREDIT")
})

runTest("isPaymentMethod: returns true for all authorized methods", () => {
    for (const m of PAYMENT_METHODS) {
        assertEqual(isPaymentMethod(m), true, `Method ${m} should be valid`)
    }
})

runTest("isPaymentMethod: returns false for unauthorized or invalid inputs", () => {
    assertEqual(isPaymentMethod("DEBIT"), false, "DEBIT is not in PAYMENT_METHODS")
    assertEqual(isPaymentMethod("CHECK"), false, "CHECK is not in PAYMENT_METHODS")
    assertEqual(isPaymentMethod(""), false, "Empty string is invalid")
    assertEqual(isPaymentMethod(null), false, "Null is invalid")
    assertEqual(isPaymentMethod(undefined), false, "Undefined is invalid")
    assertEqual(isPaymentMethod(123), false, "Number is invalid")
    assertEqual(isPaymentMethod({}), false, "Object is invalid")
})

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\nSummary: ${passedCount} passed, ${failedCount} failed`)

if (failedCount > 0) {
    process.exit(1)
}
