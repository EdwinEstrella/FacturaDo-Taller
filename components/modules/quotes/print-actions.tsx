"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, Printer } from "lucide-react"
import Link from "next/link"

interface PrintActionsProps {
    quoteId: string
    currentTemplate: string
}

export function PrintActions({ quoteId, currentTemplate }: PrintActionsProps) {
    return (
        <div className="w-full max-w-4xl mb-4 flex gap-2 no-print">
            <Link href="/quotes">
                <Button variant="outline" size="sm">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                </Button>
            </Link>
            <div className="flex gap-2 ml-auto">
                <Link href={`/quotes/${quoteId}/print?template=ticket`}>
                    <Button variant={currentTemplate === "ticket" ? "default" : "outline"} size="sm">
                        Ticket 80mm
                    </Button>
                </Link>
                <Link href={`/quotes/${quoteId}/print?template=a4`}>
                    <Button variant={currentTemplate === "a4" ? "default" : "outline"} size="sm">
                        A4
                    </Button>
                </Link>
                <Button onClick={() => window.print()} size="sm">
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir
                </Button>
            </div>
        </div>
    )
}