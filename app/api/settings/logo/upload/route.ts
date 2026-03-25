import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/actions/auth-actions"

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get("file") as File

        if (!file) {
            return NextResponse.json({ error: "Archivo es requerido" }, { status: 400 })
        }

        // Validar tipo de archivo
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: "Tipo de archivo no permitido. Solo JPG, PNG, WEBP" },
                { status: 400 }
            )
        }

        // Validar tamaño (5MB max)
        const maxSize = 5 * 1024 * 1024
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: "Archivo demasiado grande. Máximo 5MB" },
                { status: 400 }
            )
        }

        // Convertir archivo a buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Generar nombre único
        const extension = file.name.split(".").pop()
        const timestamp = Date.now()
        const filename = `${timestamp}.${extension}`

        // Subir a InsForge storage
        const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL || "https://base.azokia.com"
        const uploadUrl = `${baseUrl}/storage/buckets/company-logos/objects/${filename}`

        const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": file.type,
                "Authorization": `Bearer ${process.env.INSFORGE_ADMIN_KEY}`,
            },
            body: buffer,
        })

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text()
            console.error("Error uploading to storage:", errorText)
            return NextResponse.json(
                { error: "Error al subir archivo al storage" },
                { status: uploadResponse.status }
            )
        }

        // Obtener URL pública
        const publicUrl = `${baseUrl}/storage/buckets/company-logos/objects/${filename}?download=true`

        return NextResponse.json({
            success: true,
            url: publicUrl,
            filename
        })

    } catch (error) {
        console.error("Error uploading logo:", error)
        return NextResponse.json({ error: "Error al subir logo" }, { status: 500 })
    }
}
