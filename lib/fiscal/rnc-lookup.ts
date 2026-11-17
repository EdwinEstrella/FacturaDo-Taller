/**
 * Public DGII taxpayer lookup (RNC / cédula) via the DGII consultation web page.
 * Pure server-side helper: no auth, no framework imports, so it can be exercised directly.
 */

const DGII_RNC_URL = "https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx"
const REQUEST_TIMEOUT_MS = 15000

export interface RncLookupResult {
    rnc: string
    name: string
    commercialName: string | null
    status: string | null
}

const HTML_ENTITIES: Record<string, string> = {
    "&amp;": "&",
    "&quot;": "\"",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
}

function decodeHtml(value: string): string {
    return value
        .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
        .replace(/&[a-z]+;/g, (entity) => HTML_ENTITIES[entity] ?? entity)
        .replace(/\s+/g, " ")
        .trim()
}

function hiddenField(html: string, id: string): string {
    const match = html.match(new RegExp(`id="${id}" value="([^"]*)"`))
    if (!match) throw new Error(`DGII form field ${id} not found`)
    return match[1]
}

/** Reads the "label → value" rows of the DGII taxpayer details table. */
function parseTaxpayerTable(html: string): Map<string, string> | null {
    const table = html.match(/<table[^>]*cphMain_dvDatosContribuyentes[\s\S]*?<\/table>/)
    if (!table) return null

    const fields = new Map<string, string>()
    for (const row of table[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
        const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) =>
            decodeHtml(cell[1].replace(/<[^>]+>/g, ""))
        )
        if (cells.length >= 2) fields.set(cells[0].toLowerCase(), cells[1])
    }
    return fields
}

function extractCookies(response: Response): string {
    return response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";")[0])
        .join("; ")
}

export class RncNotFoundError extends Error {}

/** DGII answers some lookups with an empty details table and no message; those are retried. */
class EmptyDgiiAnswerError extends Error {}

const MAX_ATTEMPTS = 3
const NOT_REGISTERED_MESSAGE = /no se encuentra inscrito/i

/**
 * Fetches a taxpayer by a normalized 9-digit RNC or 11-digit cédula. Reports "not found" only when
 * DGII says so explicitly; empty answers are retried with a fresh session.
 */
export async function fetchDgiiTaxpayer(rnc: string): Promise<RncLookupResult> {
    let lastError: unknown = null
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            return await lookupOnce(rnc)
        } catch (error) {
            if (!(error instanceof EmptyDgiiAnswerError)) throw error
            lastError = error
        }
    }
    throw lastError instanceof Error ? lastError : new Error("DGII lookup failed")
}

async function lookupOnce(rnc: string): Promise<RncLookupResult> {
    const headers = { "User-Agent": "Mozilla/5.0" }
    const formPage = await fetch(DGII_RNC_URL, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" })
    if (!formPage.ok) throw new Error(`DGII form returned ${formPage.status}`)
    const formHtml = await formPage.text()

    const body = new URLSearchParams({
        __EVENTTARGET: "",
        __EVENTARGUMENT: "",
        __VIEWSTATE: hiddenField(formHtml, "__VIEWSTATE"),
        __VIEWSTATEGENERATOR: hiddenField(formHtml, "__VIEWSTATEGENERATOR"),
        __EVENTVALIDATION: hiddenField(formHtml, "__EVENTVALIDATION"),
        "ctl00$cphMain$txtRNCCedula": rnc,
        "ctl00$cphMain$btnBuscarPorRNC": "BUSCAR",
        "ctl00$cphMain$txtRazonSocial": "",
        "ctl00$cphMain$hidActiveTab": "",
    })

    const result = await fetch(DGII_RNC_URL, {
        method: "POST",
        headers: {
            ...headers,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: extractCookies(formPage),
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
    })
    if (!result.ok) throw new Error(`DGII lookup returned ${result.status}`)

    const html = await result.text()
    const fields = parseTaxpayerTable(html)
    const name = fields?.get("nombre/razón social")
    if (!name) {
        if (NOT_REGISTERED_MESSAGE.test(html)) throw new RncNotFoundError(rnc)
        throw new EmptyDgiiAnswerError(`DGII returned no taxpayer data for ${rnc}`)
    }

    return {
        rnc,
        name,
        commercialName: fields?.get("nombre comercial") || null,
        status: fields?.get("estado") || null,
    }
}
