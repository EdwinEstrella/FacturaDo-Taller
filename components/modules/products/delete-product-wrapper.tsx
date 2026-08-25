import { DeleteProductButton } from "./delete-button"

export function DeleteProductWrapper({ productId, productName }: { productId: string, productName: string }) {
    return <DeleteProductButton id={productId} name={productName} />
}
