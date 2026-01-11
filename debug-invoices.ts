import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Current System Time:", new Date().toString())

    // Fetch all invoices from Jan 8 to Jan 12 to be safe
    const invoices = await prisma.invoice.findMany({
        where: {
            createdAt: {
                gte: new Date('2026-01-08T00:00:00Z'),
                lt: new Date('2026-01-12T00:00:00Z')
            }
        },
        select: {
            id: true,
            sequenceNumber: true,
            createdAt: true,
            status: true,
            total: true
        }
    })

    console.log("Found Invoices:", invoices.length)
    invoices.forEach(inv => {
        console.log(`Invoice #${inv.sequenceNumber}:`)
        console.log(`  ID: ${inv.id}`)
        console.log(`  Created (UTC): ${inv.createdAt.toISOString()}`)
        console.log(`  Created (Local): ${inv.createdAt.toLocaleString()}`)
        console.log(`  Status: ${inv.status}`)
        console.log(`  Total: ${inv.total}`)
        console.log("---")
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
