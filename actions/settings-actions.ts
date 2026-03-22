"use server"

import { db } from "@/lib/db"
import { settings } from "@/db/schema"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"
import { eq } from "drizzle-orm"

// Define types for settings
export type CompanySettings = {
    companyName: string
    companyPhone: string
    companyRnc: string
    companyAddress: string
    /**
     * Plantilla de factura preferida para impresión.
     * "ticket" = 80mm térmica, "a4" = formato carta/A4.
     */
    invoiceTemplate?: "ticket" | "a4"
    /**
     * Logo de la empresa en formato data URL (base64) o URL pública.
     */
    companyLogo?: string
}

export async function getCompanySettings(): Promise<CompanySettings> {
    try {
        // Get all settings and filter in code (simpler than using inArray)
        const allSettings = await db.select().from(settings)

        const settingsData = allSettings.filter(s =>
            ["COMPANY_NAME", "COMPANY_PHONE", "COMPANY_RNC", "COMPANY_ADDRESS", "INVOICE_TEMPLATE", "COMPANY_LOGO"].includes(s.key)
        )

        // Default values
        const defaults: CompanySettings = {
            companyName: "FacturaDO", // Default
            companyPhone: "",
            companyRnc: "",
            companyAddress: "",
            invoiceTemplate: "ticket",
            companyLogo: "",
        }

        // Map DB results to object
        const result = settingsData.reduce((acc, current) => {
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
    try {
        const user = await getCurrentUser()
        if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
            return { success: false, error: "No tienes permisos para modificar la configuración." }
        }

        const invoiceTemplate = data.invoiceTemplate === "a4" ? "a4" : "ticket"
        const companyLogo = data.companyLogo ?? ""

        // Helper function to upsert a setting
        const upsertSetting = async (key: string, value: string) => {
            const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1)

            if (existing.length > 0) {
                await db.update(settings).set({ value }).where(eq(settings.key, key))
            } else {
                await db.insert(settings).values({ key, value })
            }
        }

        // Upsert each setting (in a transaction-like manner)
        await upsertSetting("COMPANY_NAME", data.companyName)
        await upsertSetting("COMPANY_PHONE", data.companyPhone)
        await upsertSetting("COMPANY_RNC", data.companyRnc)
        await upsertSetting("COMPANY_ADDRESS", data.companyAddress)
        await upsertSetting("INVOICE_TEMPLATE", invoiceTemplate)
        await upsertSetting("COMPANY_LOGO", companyLogo)

        revalidatePath("/settings/general") // Revalidate the form usage
        revalidatePath("/invoices") // Revalidate invoice creation pages that might use this

        return { success: true }
    } catch (error) {
        console.error("Error updating settings:", error)
        return { success: false, error: "Error al guardar la configuración." }
    }
}
