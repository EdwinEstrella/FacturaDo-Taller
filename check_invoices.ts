import { createClient } from "@insforge/sdk"
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const insforge = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "",
    headers: {
        Authorization: `Bearer ${process.env.INSFORGE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY}`
    }
})

async function run() {
    // 1. Get raw invoices
    const { data: invoices, error } = await insforge.database
        .from('Invoice')
        .select('*')
    console.log("Invoices count:", invoices?.length)
    if (error) console.error("Error:", error)

    // 2. Try the getInvoices query
    const { data: full, error: fullError } = await insforge.database
        .from('Invoice')
        .select(`
            *,
            client:Client(*),
            items:InvoiceItem(*),
            workOrder:WorkOrder(*)
        `)
    console.log("Full query error?", fullError)
    if (fullError) console.error(JSON.stringify(fullError, null, 2))
}
run()