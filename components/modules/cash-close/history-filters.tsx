"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { CalendarIcon, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface User {
    id: string
    name: string
}

interface HistoryFiltersProps {
    users: User[]
}

export function HistoryFilters({ users }: HistoryFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [date, setDate] = useState<Date | undefined>(
        searchParams.get("date") ? new Date(searchParams.get("date")!) : new Date()
    )
    const [userId, setUserId] = useState<string>(searchParams.get("userId") || "ALL")

    const handleSearch = () => {
        const params = new URLSearchParams()
        if (date) params.set("date", date.toISOString())
        if (userId && userId !== "ALL") params.set("userId", userId)

        router.push(`/cash-close-history?${params.toString()}`)
    }

    return (
        <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center bg-muted/50 p-4 rounded-lg">
            <div className="space-y-2 flex-1">
                <label className="text-sm font-medium">Fecha de Cierre</label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-full justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP") : <span>Seleccionar fecha</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>

            <div className="space-y-2 flex-1">
                <label className="text-sm font-medium">Usuario / Cajero</label>
                <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Todos los usuarios" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todos los usuarios</SelectItem>
                        {users.map(user => (
                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Button onClick={handleSearch} className="mb-0.5">
                <Search className="mr-2 h-4 w-4" />
                Buscar
            </Button>
        </div>
    )
}
