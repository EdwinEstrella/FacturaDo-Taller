"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// Manage fiscal sequences (e.g. B0100000001)
// We can store them in a simple Setting model or a dedicated table.
// For this demo we use 'Setting' model.

export async function getFiscalSequences() {
    const settings = await prisma.setting.findMany({
        where: { key: { startsWith: 'NCF_' } }
    })
    return settings
}

export async function updateFiscalSequence(type: string, current: string) {
    await prisma.setting.upsert({
        where: { key: `NCF_${type}` },
        update: { value: current },
        create: { key: `NCF_${type}`, value: current }
    })
    revalidatePath("/fiscal")
}

export async function generateNCF(type: string) {
    // Logic to increment NCF
    // Simple implementation: Get current, increment, save.
    const key = `NCF_${type}`
    const setting = await prisma.setting.findUnique({ where: { key } })

    if (!setting) return null

    const current = setting.value // e.g. B0100000005
    // Parse and increment
    const prefix = current.substring(0, 3) // B01
    const numberPart = current.substring(3)
    const nextNumber = (parseInt(numberPart) + 1).toString().padStart(8, '0')
    const nextNCF = `${prefix}${nextNumber}`

    // Update DB
    await prisma.setting.update({
        where: { key },
        data: { value: nextNCF }
    })

    return current // Return the one we just "used" (or the previous one? Usually we return the current one and bump for next)
    // Actually typically: Current is the NEXT available. So we return Current, and update DB to Current+1.
}
