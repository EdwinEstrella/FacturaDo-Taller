import type { Client, Product } from "@/types"
import type { CompanySettings } from "@/actions/settings-actions"
import type { ProductMeasurementMode } from "@/lib/product-measurements"
import type { getInvoiceById } from "@/actions/invoice-actions"

export type PosInvoice = NonNullable<Awaited<ReturnType<typeof getInvoiceById>>>

export interface SerializedProduct extends Omit<Product, "price" | "cost"> {
    price: number
    cost: number
}

export interface PosCartItem {
    lineId: string
    productId: string
    productName: string
    price: number
    quantity: number
    measurementMode: ProductMeasurementMode
    variantId?: string
    variantName?: string
    stock: number
    isService?: boolean
}

export interface PosTerminalProps {
    initialProducts: SerializedProduct[]
    initialClients: Client[]
    ecfEnabled: boolean
    settings?: CompanySettings | null
}
