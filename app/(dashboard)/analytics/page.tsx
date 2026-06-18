import { Suspense } from "react"
import { AnalyticsFilters } from "@/components/modules/analytics/analytics-filters"

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Analíticas</h2>

            <Suspense fallback={null}>
                <AnalyticsFilters />
            </Suspense>
        </div>
    )
}
