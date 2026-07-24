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
    measurementUnit?: "FEET" | "CENTIMETERS" | "INCHES" | "METERS" | null
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
    stock: number
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
    variantId?: string | null
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
    discount?: string | number
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
    variantId?: string | null
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
    tax: string | number
    discount?: string | number
    shippingCost: string | number
    applyTax: boolean
    isDraft: boolean
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "CONVERTED" | "EXPIRED"
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

export interface Payment {
    id: string
    invoiceId: string
    amount: string | number
    method: string
    reference: string | null
    notes: string | null
    date: string
    createdAt: string
}

export interface DailyClose {
    id: string
    closeDate: string
    totalCash: string | number
    totalCard: string | number
    totalTransfer: string | number
    totalCredit: string | number
    totalExpenses: string | number
    netCash: string | number
    billBreakdowns: Record<string, number>
    invoicesData: unknown[]
    expensesData: unknown[]
    notes: string | null
    closedBy: string | null
    closedByName: string | null
    createdAt: string
    updatedAt: string
}

export interface ClientHistory {
    id: string
    clientId: string
    action: string
    description: string
    metadata: string | null
    createdAt: string
}

export interface PettyCashClosing {
    id: string
    openingBalance: string | number
    totalIncome: string | number
    totalExpenses: string | number
    closingBalance: string | number
    notes: string | null
    closedBy: string | null
    closedByName: string | null
    closedAt: string
    createdAt: string
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
    measurementUnit?: "FEET" | "CENTIMETERS" | "INCHES" | "METERS" | null
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

