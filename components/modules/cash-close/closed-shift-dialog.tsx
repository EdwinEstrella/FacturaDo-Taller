"use client"

import React, { createContext, useContext, useState } from "react"
import { useRouter } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Lock, ArrowRight } from "lucide-react"

interface ShiftGuardContextType {
    hasActiveShift: boolean
    requireShift: (actionCallback?: () => void) => boolean
    openClosedShiftDialog: () => void
}

const ShiftGuardContext = createContext<ShiftGuardContextType>({
    hasActiveShift: true,
    requireShift: () => true,
    openClosedShiftDialog: () => {},
})

export const useShiftGuard = () => useContext(ShiftGuardContext)

export function ShiftGuardProvider({
    hasActiveShift,
    children
}: {
    hasActiveShift: boolean
    children: React.ReactNode
}) {
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()

    const openClosedShiftDialog = () => setIsOpen(true)

    const requireShift = (actionCallback?: () => void) => {
        if (!hasActiveShift) {
            setIsOpen(true)
            return false
        }
        if (actionCallback) actionCallback()
        return true
    }

    const handleRedirect = () => {
        setIsOpen(false)
        router.push("/daily-close")
    }

    return (
        <ShiftGuardContext.Provider value={{ hasActiveShift, requireShift, openClosedShiftDialog }}>
            {children}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-md border-amber-300">
                    <DialogHeader>
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 mb-2">
                            <Lock className="h-6 w-6 text-amber-600" />
                        </div>
                        <DialogTitle className="text-center text-xl font-bold text-gray-900">
                            Caja Cerrada
                        </DialogTitle>
                        <DialogDescription className="text-center text-sm text-gray-600 pt-2">
                            No hay un turno de caja abierto. Para facturar, cobrar o registrar gastos, debés iniciar el turno.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                            className="w-full sm:w-auto"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleRedirect}
                            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
                        >
                            Abrir Turno
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </ShiftGuardContext.Provider>
    )
}
