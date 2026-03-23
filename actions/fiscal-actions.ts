"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getFiscalSequences() {
    const supabase = await createClient()

    const { data, error } = await supabase
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
    const supabase = await createClient()

    const { data: existing } = await supabase
        .from('Setting')
        .select('key')
        .eq('key', `NCF_${type}`)
        .single()

    if (existing) {
        await supabase
            .from('Setting')
            .update({ value: current })
            .eq('key', `NCF_${type}`)
    } else {
        await supabase
            .from('Setting')
            .insert({ key: `NCF_${type}`, value: current })
    }

    revalidatePath("/fiscal")
}

export async function generateNCF(type: string) {
    const supabase = await createClient()
    const key = `NCF_${type}`

    const { data: setting } = await supabase
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

    await supabase
        .from('Setting')
        .update({ value: nextNCF })
        .eq('key', key)

    return current
}
