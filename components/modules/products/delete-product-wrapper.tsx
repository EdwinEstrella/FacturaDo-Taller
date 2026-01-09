import { getCurrentUser } from "@/actions/auth-actions"
import { DeleteProductButton } from "./delete-button"

export async function DeleteProductWrapper({ productId, productName }: { productId: string, productName: string }) {
    const user = await getCurrentUser()
    const isSeller = user?.role === 'SELLER'

    if (isSeller) return null

    return <DeleteProductButton id={productId} name={productName} />
}
