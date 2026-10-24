"use client"

import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"
import { Loader2 } from "lucide-react"
import { SegmentedControl } from "@/components/modules/shared/list-page"
import type { DashboardPeriod } from "@/lib/dashboard-stats"

const OPTIONS: { value: DashboardPeriod; label: string }[] = [
    { value: "today", label: "Hoy" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mes" },
    { value: "year", label: "Año" },
]

export function PeriodSwitcher({ value }: { value: DashboardPeriod }) {
    const router = useRouter()
    const pathname = usePathname()
    const [pending, startTransition] = useTransition()

    return (
        <div className="flex items-center gap-2">
            {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <SegmentedControl
                options={OPTIONS}
                value={value}
                onChange={(p) => startTransition(() => router.push(p === "month" ? pathname : `${pathname}?p=${p}`))}
            />
        </div>
    )
}
