import { getFiscalSequences, updateFiscalSequence } from "@/actions/fiscal-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function FiscalPage() {
    const sequences = await getFiscalSequences()

    const getValue = (type: string) => sequences.find(s => s.key === `NCF_${type}`)?.value || ""

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Comprobantes Fiscales</h2>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Secuencias NCF</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form action={async (formData) => {
                            "use server"
                            const type = formData.get("type") as string
                            const value = formData.get("value") as string
                            await updateFiscalSequence(type, value)
                        }}>
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="B01">Crédito Fiscal (B01)</Label>
                                <div className="flex space-x-2">
                                    <Input name="value" defaultValue={getValue("B01")} placeholder="B0100000001" />
                                    <Input type="hidden" name="type" value="B01" />
                                    <Button type="submit">Guardar</Button>
                                </div>
                            </div>
                        </form>

                        <form action={async (formData) => {
                            "use server"
                            const type = formData.get("type") as string
                            const value = formData.get("value") as string
                            await updateFiscalSequence(type, value)
                        }}>
                            <div className="grid w-full items-center gap-1.5 mt-4">
                                <Label htmlFor="B02">Consumidor Final (B02)</Label>
                                <div className="flex space-x-2">
                                    <Input name="value" defaultValue={getValue("B02")} placeholder="B0200000001" />
                                    <Input type="hidden" name="type" value="B02" />
                                    <Button type="submit">Guardar</Button>
                                </div>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
