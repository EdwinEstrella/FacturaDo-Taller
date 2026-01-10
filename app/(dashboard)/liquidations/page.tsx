import { getUsersForLiquidation } from "@/actions/liquidation-actions"
import LiquidationForm from "@/components/modules/liquidations/liquidation-form"

export default async function LiquidationsPage() {
    const users = await getUsersForLiquidation()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight print:hidden">Liquidaciones & Comisiones</h2>
            <LiquidationForm users={users} />
        </div>
    )
}
