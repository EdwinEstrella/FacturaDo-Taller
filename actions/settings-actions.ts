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
}

export async function getCompanySettings(): Promise<CompanySettings> {
    try {
        const settings = await prisma.setting.findMany({
            where: {
                key: {
                    in: ["COMPANY_NAME", "COMPANY_PHONE", "COMPANY_RNC", "COMPANY_ADDRESS"]
                }
            }
        })

        // Default values
        const defaults: CompanySettings = {
            companyName: "FacturaDO", // Default
            companyPhone: "",
            companyRnc: "",
            companyAddress: ""
        }

        // Map DB results to object
        const result = settings.reduce((acc, current) => {
            if (current.key === "COMPANY_NAME") acc.companyName = current.value
            if (current.key === "COMPANY_PHONE") acc.companyPhone = current.value
            if (current.key === "COMPANY_RNC") acc.companyRnc = current.value
            if (current.key === "COMPANY_ADDRESS") acc.companyAddress = current.value
            return acc
        }, defaults)

        return result
    } catch (error) {
        console.error("Error fetching settings:", error)
        return {
            companyName: "FacturaDO",
            companyPhone: "",
            companyRnc: "",
            companyAddress: ""
        }
    }
}

export async function updateCompanySettings(data: CompanySettings) {
    try {
        const user = await getCurrentUser()
        if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
            return { success: false, error: "No tienes permisos para modificar la configuración." }
        }

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
            })
        ])

        revalidatePath("/settings/general") // Revalidate the form usage
        revalidatePath("/invoices") // Revalidate invoice creation pages that might use this

        return { success: true }
    } catch (error) {
        console.error("Error updating settings:", error)
        return { success: false, error: "Error al guardar la configuración." }
    }
}
