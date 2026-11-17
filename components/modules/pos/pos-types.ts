import type { Client, Product, ProductCharacteristic } from "@/types"
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
    characteristics: ProductCharacteristic[]
}

export interface PosSaleDetails {
    shippingCost: number
    discount: number
    deliveryDate?: Date
    notes: string
    includeInstallation: boolean
    installationAmount: number
}

export interface PosTerminalProps {
    initialProducts: SerializedProduct[]
    initialClients: Client[]
    ecfEnabled: boolean
    installationProductId: string | null
    settings?: CompanySettings | null
}
