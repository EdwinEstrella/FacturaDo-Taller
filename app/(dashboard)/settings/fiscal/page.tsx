import { getFiscalSequences } from "@/actions/fiscal-actions"
import { FiscalSettingsClient } from "./client"

export default async function FiscalSettingsPage() {
    const sequences = await getFiscalSequences()
    const getValue = (type: string) => (sequences.find((s) => s.key === `NCF_${type}`)?.value as string | undefined) || ""

    return <FiscalSettingsClient b01={getValue("B01")} b02={getValue("B02")} />
}
