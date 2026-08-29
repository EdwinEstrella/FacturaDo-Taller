import { getCurrentShiftSummary } from "@/actions/cash-shift-actions"
import { DailyCloseContent } from "@/components/modules/daily-close/daily-close-content"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default async function DailyClosePage() {
    const summary = await getCurrentShiftSummary()

    if (!summary) {
        redirect("/login")
    }

    return (
        <DailyCloseContent summary={summary} />
    )
}
