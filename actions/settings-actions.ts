"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth-actions"

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
        const settings = await prisma.setting.findMany({
            where: {
                key: {
                    in: [
                        "COMPANY_NAME",
                        "COMPANY_PHONE",
                        "COMPANY_RNC",
                        "COMPANY_ADDRESS",
                        "INVOICE_TEMPLATE",
                        "COMPANY_LOGO",
                    ]
                }
            }
        })

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
        const result = settings.reduce((acc, current) => {
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

        // Upsert each setting
        await prisma.$transaction([
            prisma.setting.upsert({
                where: { key: "COMPANY_NAME" },
                update: { value: data.companyName },
                create: { key: "COMPANY_NAME", value: data.companyName }
            }),
            prisma.setting.upsert({
                where: { key: "COMPANY_PHONE" },
                update: { value: data.companyPhone },
                create: { key: "COMPANY_PHONE", value: data.companyPhone }
            }),
            prisma.setting.upsert({
                where: { key: "COMPANY_RNC" },
                update: { value: data.companyRnc },
                create: { key: "COMPANY_RNC", value: data.companyRnc }
            }),
            prisma.setting.upsert({
                where: { key: "COMPANY_ADDRESS" },
                update: { value: data.companyAddress },
                create: { key: "COMPANY_ADDRESS", value: data.companyAddress }
            }),
            prisma.setting.upsert({
                where: { key: "INVOICE_TEMPLATE" },
                update: { value: invoiceTemplate },
                create: { key: "INVOICE_TEMPLATE", value: invoiceTemplate }
            }),
            prisma.setting.upsert({
                where: { key: "COMPANY_LOGO" },
                update: { value: companyLogo },
                create: { key: "COMPANY_LOGO", value: companyLogo }
            }),
        ])

        revalidatePath("/settings/general") // Revalidate the form usage
        revalidatePath("/invoices") // Revalidate invoice creation pages that might use this

        return { success: true }
    } catch (error) {
        console.error("Error updating settings:", error)
        return { success: false, error: "Error al guardar la configuración." }
    }
}
