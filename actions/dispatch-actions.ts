"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getTechnicianDispatches(technicianId: string) {
    const dispatches = await prisma.dispatch.findMany({
        where: {
            technicianId,
            status: {
                in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS']
            }
        },
        include: {
            invoice: {
                include: {
                    client: true,
                    items: true
                }
            }
        },
        orderBy: { createdAt: 'asc' }
    })

    // Serialize Decimal to number for client components
    return dispatches.map(dispatch => ({
        ...dispatch,
        invoice: dispatch.invoice ? {
            ...dispatch.invoice,
            total: Number(dispatch.invoice.total),
            items: dispatch.invoice.items.map(item => ({
                ...item,
                price: Number(item.price)
            }))
        } : null
    }))
}

export async function updateDispatchStatus(
    dispatchId: string,
    status: string,
    notes?: string,
    photos?: string[]
) {
    const updateData: {
        status: string
        notes?: string
        deliveredAt?: Date
        installedAt?: Date
    } = {
        status
    }

    if (notes) {
        updateData.notes = notes
    }

    if (status === 'DELIVERED') {
        updateData.deliveredAt = new Date()
    }

    if (status === 'INSTALLED') {
        updateData.installedAt = new Date()
    }

    const dispatch = await prisma.dispatch.update({
        where: { id: dispatchId },
        data: updateData
    })

    // Si hay fotos, guardarlas
    if (photos && photos.length > 0) {
        await prisma.dispatchPhoto.createMany({
            data: photos.map(photoUrl => ({
                dispatchId,
                photoUrl,
                takenBy: dispatch.technicianId || undefined
            }))
        })
    }

    revalidatePath('/technician')
    revalidatePath('/dispatch')

    return dispatch
}

export async function getDispatchById(dispatchId: string) {
    const dispatch = await prisma.dispatch.findUnique({
        where: { id: dispatchId },
        include: {
            invoice: {
                include: {
                    client: true,
                    items: true
                }
            },
            photos: true,
            technician: true
        }
    })

    if (!dispatch) return null

    // Serialize Decimal to number for client components
    return {
        ...dispatch,
        invoice: dispatch.invoice ? {
            ...dispatch.invoice,
            total: Number(dispatch.invoice.total),
            items: dispatch.invoice.items.map(item => ({
                ...item,
                price: Number(item.price)
            }))
        } : null
    }
}
