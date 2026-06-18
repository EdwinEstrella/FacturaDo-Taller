"use server"


import { requireAuth } from "@/actions/auth-actions";
import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"

export async function getFiscalSequences() {
    await requireAuth();

    const insforge = createServerClient()

    const { data, error } = await insforge.database
        .from('Setting')
        .select('*')
        .like('key', 'NCF_%')

    if (error) {
        console.error(error)
        return []
    }

    return data || []
}

export async function updateFiscalSequence(type: string, current: string) {
    await requireAuth();

    const insforge = createServerClient()

    const { data: existing } = await insforge.database
        .from('Setting')
        .select('key')
        .eq('key', `NCF_${type}`)
        .single()

    if (existing) {
        await insforge.database
            .from('Setting')
            .update({ value: current })
            .eq('key', `NCF_${type}`)
    } else {
        await insforge.database
            .from('Setting')
            .insert([{ key: `NCF_${type}`, value: current }])
    }

    revalidatePath("/fiscal")
}

export async function generateNCF(type: string) {
    await requireAuth();

    const insforge = createServerClient()
    const key = `NCF_${type}`

    const { data: setting } = await insforge.database
        .from('Setting')
        .select('*')
        .eq('key', key)
        .single()

    if (!setting) return null

    const current = setting.value
    const prefix = current.substring(0, 3)
    const numberPart = current.substring(3)
    const nextNumber = (parseInt(numberPart) + 1).toString().padStart(8, '0')
    const nextNCF = `${prefix}${nextNumber}`

    await insforge.database
        .from('Setting')
        .update({ value: nextNCF })
        .eq('key', key)

    return current
}
