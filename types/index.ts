// Tipos compartidos para reemplazar Database types de Supabase

// Tipos base
export type UserRole = "ADMIN" | "SELLER" | "ACCOUNTANT" | "TECHNICIAN" | "MANAGER" | "CUSTOM"

export interface Client {
    id: string
    name: string
    rnc: string | null
    cedula: string | null
    address: string | null
    phone: string | null
    email: string | null
    createdAt: string
    updatedAt: string
}

export interface Product {
    id: string
    name: string
    description: string | null
    price: string | number
    cost: string | number
    stock: number
    minStock: number
    sku: string | null
    category: "MATERIAL" | "ARTICULO" | "SERVICIO"
    unitType: "UNIT" | "MEASURE"
    isService: boolean
    hasVariants: boolean
    variants?: ProductVariant[]
    createdAt: string
    updatedAt: string
}

export interface ProductVariant {
    id: string
    productId: string
    name: string
    price: string | number
    cost: string | number
    sku: string | null
    createdAt: string
}

export interface InvoiceItem {
    id: string
    invoiceId: string
    productId: string | null
    productName: string
    quantity: number
    price: string | number
    createdAt: string
}

export interface Invoice {
    id: string
    clientId: string | null
    clientName: string | null
    total: string | number
    balance: string | number
    status: "PAID" | "PENDING" | "CANCELLED"
    paymentMethod: string
    shippingCost: string | number
    tax: string | number
    hasNcf: boolean
    ncf?: string | null
    dispatched: boolean
    deliveryDate: string | null
    notes: string | null
    createdAt: string
    updatedAt: string
    createdById: string
    creatorName: string | null
    sequenceNumber: number
}

export interface QuoteItem {
    id: string
    quoteId: string
    productId: string | null
    productName: string
    quantity: number
    price: string | number
}

export interface Dispatch {
    id: string
    invoiceId: string
    status: "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "DELIVERED" | "INSTALLED"
    technicianId: string | null
    driverName: string | null
    notes: string | null
    deliveredAt: string | null
    installedAt: string | null
    createdAt: string
}

export interface DispatchPhoto {
    id: string
    dispatchId: string
    url: string
    createdAt: string
}

export interface Quote {
    id: string
    clientId: string | null
    clientName: string | null
    total: string | number
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "CONVERTED"
    notes: string | null
    validUntil: string | null
    createdAt: string
    updatedAt: string
    createdById: string
    sequenceNumber: number
}

export interface User {
    id: string
    name: string
    username: string
    password: string
    phone: string | null
    role: UserRole
    customPermissions: Record<string, unknown>
    createdAt: string | Date
    updatedAt: string | Date
}

// Tipos para actualizaciones (todos los campos son opcionales excepto id)
export interface ClientUpdate {
    id?: string
    name?: string
    rnc?: string | null
    cedula?: string | null
    address?: string | null
    phone?: string | null
    email?: string | null
}

export interface DispatchUpdate {
    id?: string
    status?: "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "DELIVERED" | "INSTALLED"
    technicianId?: string | null
    driverName?: string | null
    notes?: string | null
    deliveredAt?: string | null
    installedAt?: string | null
}

export interface InvoiceUpdate {
    id?: string
    status?: "PAID" | "PENDING" | "CANCELLED"
    total?: string | number
    balance?: string | number
}

export interface ProductUpdate {
    id?: string
    name?: string
    description?: string | null
    price?: string | number
    cost?: string | number
    stock?: number
    minStock?: number
    sku?: string | null
    category?: "MATERIAL" | "ARTICULO" | "SERVICIO"
    unitType?: "UNIT" | "MEASURE"
    isService?: boolean
    hasVariants?: boolean
}

export interface UserUpdate {
    id?: string
    name?: string
    username?: string
    phone?: string | null
    role?: string
    customPermissions?: Record<string, unknown>
}

