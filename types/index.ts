/**
 * Tipos compartidos para la aplicación
 * Evita el uso de 'any' y proporciona tipado fuerte
 */

// ==================== User Types ====================
export type UserRole = "ADMIN" | "SELLER" | "ACCOUNTANT"

export interface User {
    id: string
    name: string | null
    username: string
    role: UserRole
    createdAt: Date
    updatedAt: Date
}

export interface CreateUserInput {
    name: string
    username: string
    password: string
    role: UserRole
}

export interface UpdateUserInput {
    name?: string
    username?: string
    password?: string
    role?: UserRole
}

// ==================== Invoice Types ====================
export interface InvoiceItem {
    id: string
    productId: string
    productName: string
    quantity: number
    price: number
    invoiceId?: string
}

export interface Invoice {
    id: string
    clientId: string
    client: {
        id: string
        name: string
        rnc?: string | null
        address?: string | null
        phone?: string | null
        email?: string | null
    }
    items: InvoiceItem[]
    total: number
    paymentMethod?: string | null
    ncfType?: string | null
    ncf?: string | null
    status?: string | null
    createdAt: Date
    updatedAt: Date
}

export interface CreateInvoiceInput {
    clientId: string
    clientName?: string
    items: {
        productId: string
        productName: string
        quantity: number
        price: number
    }[]
    total: number
    paymentMethod?: string
    ncfType?: string
}

// ==================== Client Types ====================
export interface Client {
    id: string
    name: string
    rnc?: string | null
    address?: string | null
    phone?: string | null
    email?: string | null
    createdAt: Date
    updatedAt: Date
}

export interface CreateClientInput {
    name: string
    rnc?: string
    address?: string
    phone?: string
    email?: string
}

// ==================== Product Types ====================
export interface Product {
    id: string
    name: string
    description?: string | null
    price: number
    stock: number
    createdAt: Date
    updatedAt: Date
}

export interface CreateProductInput {
    name: string
    description?: string
    price: number
    stock?: number
}

// ==================== Quote Types ====================
export interface Quote {
    id: string
    clientId: string
    client: Client
    items: InvoiceItem[]
    total: number
    validUntil?: Date | null
    status?: string | null
    createdAt: Date
    updatedAt: Date
}

// ==================== Work Order Types ====================
export interface WorkOrder {
    id: string
    invoiceId: string
    status: string
    productionNotes?: string | null
    createdAt: Date
    updatedAt: Date
}

// ==================== Dispatch Types ====================
export interface DispatchInfo {
    id: string
    invoiceId: string
    driverName?: string | null
    vehiclePlate?: string | null
    deliveryDate?: Date | null
    notes?: string | null
    createdAt: Date
    updatedAt: Date
}

// ==================== Transaction Types ====================
export interface Transaction {
    id: string
    invoiceId?: string | null
    type: "INCOME" | "EXPENSE"
    amount: number
    description?: string | null
    category?: string | null
    createdAt: Date
    updatedAt: Date
}

// ==================== Response Types ====================
export interface ActionResponse<T = void> {
    success: boolean
    error?: string
    data?: T
}
