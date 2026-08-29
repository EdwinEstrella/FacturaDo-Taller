"use client"

import React, { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

export function formatNumberWithCommas(value: string | number): string {
    if (value === "" || value === null || value === undefined) return ""
    const clean = String(value).replace(/[^0-9.]/g, "")
    const parts = clean.split(".")
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    if (parts.length > 1) {
        return `${integerPart}.${parts.slice(1).join("").slice(0, 2)}`
    }
    return integerPart
}

export function parseFormattedNumber(formatted: string): number {
    if (!formatted) return 0
    const clean = formatted.replace(/,/g, "")
    const num = parseFloat(clean)
    return isNaN(num) ? 0 : num
}

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number | string
    onValueChange: (numericValue: number, formattedString: string) => void
    prefix?: string
    inputClassName?: string
}

export function CurrencyInput({
    value,
    onValueChange,
    prefix = "RD$",
    className,
    inputClassName,
    disabled,
    placeholder = "0.00",
    ...props
}: CurrencyInputProps) {
    const [displayValue, setDisplayValue] = useState(() => formatNumberWithCommas(value))

    useEffect(() => {
        setDisplayValue(formatNumberWithCommas(value))
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputVal = e.target.value
        // Permitir solo números y un solo punto
        const clean = inputVal.replace(/[^0-9.]/g, "")
        const dotCount = (clean.match(/\./g) || []).length
        if (dotCount > 1) return

        const formatted = formatNumberWithCommas(clean)
        setDisplayValue(formatted)
        const numeric = parseFormattedNumber(formatted)
        onValueChange(numeric, formatted)
    }

    return (
        <div className={cn(
            "flex items-center rounded-lg border border-input bg-white shadow-xs transition-colors overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500",
            disabled && "opacity-50 cursor-not-allowed bg-gray-50",
            className
        )}>
            {prefix && (
                <span className="flex items-center justify-center px-3.5 py-2.5 bg-gray-100/90 border-r border-input text-gray-700 font-bold text-sm select-none">
                    {prefix}
                </span>
            )}
            <input
                type="text"
                inputMode="decimal"
                value={displayValue}
                onChange={handleChange}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                    "flex-1 w-full px-3.5 py-2 text-lg font-mono font-bold text-gray-900 bg-transparent outline-hidden border-none focus:outline-hidden focus:ring-0",
                    inputClassName
                )}
                {...props}
            />
        </div>
    )
}
