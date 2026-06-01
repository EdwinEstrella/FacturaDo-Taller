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
    companyLogoKey?: string
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
                "COMPANY_LOGO",
                "COMPANY_LOGO_KEY"
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
            companyLogoKey: "",
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
            if (current.key === "COMPANY_LOGO_KEY") acc.companyLogoKey = current.value
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
            companyLogoKey: "",
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

        // Handle logo upload to bucket
        let companyLogoUrl = data.companyLogo ?? ""
        let companyLogoKey = ""

        // If companyLogo is a base64 string, upload it to the bucket using SDK
        if (companyLogoUrl && companyLogoUrl.startsWith("data:image/")) {
            try {
                // Extract the base64 data
                const matches = companyLogoUrl.match(/^data:image\/(\w+);base64,(.+)$/)
                if (matches && matches[2]) {
                    const extension = matches[1] // png, jpeg, etc.
                    const mimeType = `image/${extension}`
                    const base64Data = matches[2]
                    const buffer = Buffer.from(base64Data, "base64")

                    // Create a File object from the buffer
                    const fileName = `company-logo-${Date.now()}.${extension}`
                    const file = new File([buffer], fileName, { type: mimeType })

                    // Upload using InsForge SDK
                    const { data: uploadData, error: uploadError } = await insforge.storage
                        .from('company-logos')
                        .upload(fileName, file)

                    if (uploadError || !uploadData) {
                        console.error("Failed to upload logo to bucket:", uploadError)
                        companyLogoUrl = "" // Clear logo if upload failed
                    } else {
                        // IMPORTANT: Save both url and key
                        companyLogoUrl = uploadData.url
                        companyLogoKey = uploadData.key
                        console.log("Logo uploaded successfully:", companyLogoUrl)
                    }
                }
            } catch (uploadError) {
                console.error("Error uploading logo:", uploadError)
                companyLogoUrl = "" // Clear logo if upload fails
            }
        }

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
        await upsertSetting("COMPANY_LOGO", companyLogoUrl)
        await upsertSetting("COMPANY_LOGO_KEY", companyLogoKey)

        revalidatePath("/settings/general")
        revalidatePath("/invoices")

        return { success: true }
    } catch (error) {
        console.error("Error updating settings:", error)
        return { success: false, error: "Error al guardar la configuración." }
    }
}
