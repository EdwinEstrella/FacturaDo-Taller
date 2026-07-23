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

async function addFks() {
    const queries = [
        `ALTER TABLE public."Invoice" ALTER COLUMN "clientId" TYPE uuid USING "clientId"::uuid;`,
        `ALTER TABLE public."Invoice" ADD CONSTRAINT invoice_client_fk FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON DELETE SET NULL;`,
        
        `ALTER TABLE public."InvoiceItem" ALTER COLUMN "invoiceId" TYPE uuid USING "invoiceId"::uuid;`,
        `ALTER TABLE public."InvoiceItem" ADD CONSTRAINT invoiceitem_invoice_fk FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON DELETE CASCADE;`,
        
        `ALTER TABLE public."WorkOrder" ALTER COLUMN "invoiceId" TYPE uuid USING "invoiceId"::uuid;`,
        `ALTER TABLE public."WorkOrder" ADD CONSTRAINT workorder_invoice_fk FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON DELETE CASCADE;`,

        `ALTER TABLE public."Dispatch" ALTER COLUMN "invoiceId" TYPE uuid USING "invoiceId"::uuid;`,
        `ALTER TABLE public."Dispatch" ADD CONSTRAINT dispatch_invoice_fk FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON DELETE CASCADE;`
    ]
    
    for (const q of queries) {
        console.log("Executing:", q)
        const { error } = await insforge.database.rpc('exec_sql', { sql: q })
        if (error) {
            console.log("Error (might not have exec_sql RPC):", error.message)
        }
    }
}
addFks()