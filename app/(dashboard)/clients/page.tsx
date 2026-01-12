import { getClients } from "@/actions/client-actions"
import { ClientsClient } from "@/components/modules/clients/clients-client"

export default async function ClientsPage() {
    const clients = await getClients()

    return <ClientsClient initialClients={clients} />
}
