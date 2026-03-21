"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, Printer } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface PrintActionsProps {
    quoteId: string
    currentTemplate: string
}

export function PrintActions({ quoteId, currentTemplate }: PrintActionsProps) {
    const router = useRouter()

    const changeTemplate = (template: string) => {
        router.push(`/quotes/${quoteId}/print?template=${template}`)
    }

    return (
        <div className="w-full max-w-4xl mb-4 flex gap-2 no-print">
            <Link href="/quotes">
                <Button variant="outline" size="sm">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                </Button>
            </Link>
            <div className="flex gap-2 ml-auto">
                <Button
                    variant={currentTemplate === "ticket" ? "default" : "outline"}
                    size="sm"
                    onClick={() => changeTemplate("ticket")}
                >
                    Ticket 80mm
                </Button>
                <Button
                    variant={currentTemplate === "a4" ? "default" : "outline"}
                    size="sm"
                    onClick={() => changeTemplate("a4")}
                >
                    A4
                </Button>
                <Button onClick={() => window.print()} size="sm">
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir
                </Button>
            </div>
        </div>
    )
}
