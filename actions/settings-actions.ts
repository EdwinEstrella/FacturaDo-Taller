"use server"

import { createServerClient } from "@/lib/insforge/client"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"

export type CompanySettings = {
    companyName: string
    companyPhone: string
    companyRnc: string
    companyAddress: string
    invoiceTemplate?: "ticket" | "a4"
    companyLogo?: string
}

export async function getCompanySettings(): Promise<CompanySettings> {
    const insforge = createServerClient()

    try {
        const { data: allSettings, error } = await insforge.database
            .from('Setting')
            .select('*')
            .in('key', [
                "COMPANY_NAME",
                "COMPANY_PHONE",
                "COMPANY_RNC",
                "COMPANY_ADDRESS",
                "INVOICE_TEMPLATE",
                "COMPANY_LOGO"
            ])

        if (error) {
            throw error
        }

        const defaults: CompanySettings = {
            companyName: "FacturaDO",
            companyPhone: "",
            companyRnc: "",
            companyAddress: "",
            invoiceTemplate: "ticket",
            companyLogo: "",
        }

        if (!allSettings || allSettings.length === 0) {
            return defaults
        }

        const result = allSettings.reduce((acc, current) => {
            if (current.key === "COMPANY_NAME") acc.companyName = current.value
            if (current.key === "COMPANY_PHONE") acc.companyPhone = current.value
            if (current.key === "COMPANY_RNC") acc.companyRnc = current.value
            if (current.key === "COMPANY_ADDRESS") acc.companyAddress = current.value
            if (current.key === "INVOICE_TEMPLATE") acc.invoiceTemplate = (current.value === "a4" ? "a4" : "ticket")
            if (current.key === "COMPANY_LOGO") acc.companyLogo = current.value
            return acc
        }, defaults)

        return result
    } catch (error) {
        console.error("Error fetching settings:", error)
        return {
            companyName: "FacturaDO",
            companyPhone: "",
            companyRnc: "",
            companyAddress: "",
            invoiceTemplate: "ticket",
            companyLogo: "",
        }
    }
}

export async function updateCompanySettings(data: CompanySettings) {
    const user = await getCurrentUser()

    if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
        return { success: false, error: "No tienes permisos para modificar la configuración." }
    }

    const insforge = createServerClient()

    try {
        const invoiceTemplate = data.invoiceTemplate === "a4" ? "a4" : "ticket"
        const companyLogo = data.companyLogo ?? ""

        // Helper function to upsert a setting
        const upsertSetting = async (key: string, value: string) => {
            // Check if setting exists
            const { data: existing } = await insforge.database
                .from('Setting')
                .select('key')
                .eq('key', key)
                .single()

            if (existing) {
                await insforge.database
                    .from('Setting')
                    .update({ value })
                    .eq('key', key)
            } else {
                await insforge.database
                    .from('Setting')
                    .insert([{ key, value }])
            }
        }

        // Upsert each setting
        await upsertSetting("COMPANY_NAME", data.companyName)
        await upsertSetting("COMPANY_PHONE", data.companyPhone)
        await upsertSetting("COMPANY_RNC", data.companyRnc)
        await upsertSetting("COMPANY_ADDRESS", data.companyAddress)
        await upsertSetting("INVOICE_TEMPLATE", invoiceTemplate)
        await upsertSetting("COMPANY_LOGO", companyLogo)

        revalidatePath("/settings/general")
        revalidatePath("/invoices")

        return { success: true }
    } catch (error) {
        console.error("Error updating settings:", error)
        return { success: false, error: "Error al guardar la configuración." }
    }
}
