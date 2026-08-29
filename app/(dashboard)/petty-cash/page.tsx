import { getPettyCashSummary } from "@/actions/petty-cash-actions"
import { PettyCashContent } from "@/components/modules/petty-cash/petty-cash-content"
import "./petty-cash.css"

export const dynamic = 'force-dynamic'

export default async function PettyCashPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const [{ q = "" }, summary] = await Promise.all([
        searchParams,
        getPettyCashSummary()
    ])

    return (
        <PettyCashContent summary={summary} initialQuery={q} />
    )
}