"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from "date-fns"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function AnalyticsFilters({ className }: { className?: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Initialize state from URL params
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")

    const [date, setDate] = React.useState<DateRange | undefined>({
        from: fromParam ? new Date(fromParam) : startOfMonth(new Date()),
        to: toParam ? new Date(toParam) : endOfMonth(new Date()),
    })

    const [preset, setPreset] = React.useState<string>("this_month")

    // Update URL when date changes
    const applyFilter = (newDate: DateRange | undefined) => {
        setDate(newDate)
        if (newDate?.from) {
            const params = new URLSearchParams(searchParams)
            params.set("from", format(newDate.from, "yyyy-MM-dd"))
            if (newDate.to) {
                params.set("to", format(newDate.to, "yyyy-MM-dd"))
            } else {
                params.delete("to")
            }
            router.push(`?${params.toString()}`)
        }
    }

    const handlePresetChange = (value: string) => {
        setPreset(value)
        const now = new Date()
        let newRange: DateRange | undefined

        switch (value) {
            case "today":
                newRange = { from: now, to: now }
                break
            case "yesterday":
                const y = subDays(now, 1)
                newRange = { from: y, to: y }
                break
            case "this_week":
                newRange = { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }
                break
            case "last_week":
                const lastWeek = subDays(now, 7)
                newRange = { from: startOfWeek(lastWeek, { weekStartsOn: 1 }), to: endOfWeek(lastWeek, { weekStartsOn: 1 }) }
                break
            case "this_month":
                newRange = { from: startOfMonth(now), to: endOfMonth(now) }
                break
            case "last_month":
                const lastMonth = subMonths(now, 1)
                newRange = { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }
                break
            case "last_90_days":
                newRange = { from: subDays(now, 90), to: now }
                break
            case "this_year":
                newRange = { from: new Date(now.getFullYear(), 0, 1), to: now }
                break
            case "custom":
                return // Do nothing, let user pick
            default:
                return
        }

        if (newRange) {
            applyFilter(newRange)
        }
    }

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <Select value={preset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="yesterday">Ayer</SelectItem>
                    <SelectItem value="this_week">Esta Semana</SelectItem>
                    <SelectItem value="last_week">Semana Pasada</SelectItem>
                    <SelectItem value="this_month">Este Mes</SelectItem>
                    <SelectItem value="last_month">Mes Pasado</SelectItem>
                    <SelectItem value="last_90_days">Últimos 90 Días</SelectItem>
                    <SelectItem value="this_year">Este Año</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
            </Select>

            {preset === 'custom' && (
                <DatePickerWithRange date={date} setDate={applyFilter} />
            )}
        </div>
    )
}
