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

    const normalizedType = type.toUpperCase()
    const normalizedCurrent = current.toUpperCase()

    if (!['B01', 'B02'].includes(normalizedType)) {
        throw new Error("Tipo de comprobante fiscal inválido")
    }

    if (!new RegExp(`^${normalizedType}\\d{8}$`).test(normalizedCurrent)) {
        throw new Error(`El NCF debe tener el formato ${normalizedType} seguido de 8 dígitos`)
    }

    const insforge = createServerClient()

    const { data: existing } = await insforge.database
        .from('Setting')
        .select('key')
        .eq('key', `NCF_${normalizedType}`)
        .single()

    if (existing) {
        await insforge.database
            .from('Setting')
            .update({ value: normalizedCurrent })
            .eq('key', `NCF_${normalizedType}`)
    } else {
        await insforge.database
            .from('Setting')
            .insert([{ key: `NCF_${normalizedType}`, value: normalizedCurrent }])
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
