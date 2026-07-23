import fs from 'fs'

const filePath = 'actions/invoice-actions.ts'
let content = fs.readFileSync(filePath, 'utf8')

// Replace getInvoices
content = content.replace(/export async function getInvoices\(\) \{[\s\S]*?\}\n\nexport async function getInvoiceById/m, `export async function getInvoices() {
    await requireAuth();

    const insforge = createServerClient()

    const { data: invoices, error } = await insforge.database
        .from('Invoice')
        .select('*')
        .order('createdAt', { ascending: false })

    if (error) {
        console.error(error)
        return []
    }

    const invoiceIds = (invoices || []).map(i => i.id)
    const clientIds = [...new Set((invoices || []).map(i => i.clientId).filter(Boolean))]

    const [{ data: clients }, { data: items }, { data: workOrders }] = await Promise.all([
        clientIds.length > 0 ? insforge.database.from('Client').select('*').in('id', clientIds) : Promise.resolve({ data: [] }),
        invoiceIds.length > 0 ? insforge.database.from('InvoiceItem').select('*').in('invoiceId', invoiceIds) : Promise.resolve({ data: [] }),
        invoiceIds.length > 0 ? insforge.database.from('WorkOrder').select('*').in('invoiceId', invoiceIds) : Promise.resolve({ data: [] })
    ])

    const clientsMap = Object.fromEntries((clients || []).map(c => [c.id, c]))
    const itemsMap = (items || []).reduce((acc, item) => {
        if (!acc[item.invoiceId]) acc[item.invoiceId] = []
        acc[item.invoiceId].push(item)
        return acc
    }, {})
    const workOrdersMap = Object.fromEntries((workOrders || []).map(w => [w.invoiceId, w]))

    return invoices.map(invoice => ({
        ...invoice,
        client: invoice.clientId ? clientsMap[invoice.clientId] : null,
        workOrder: workOrdersMap[invoice.id] || null,
        total: Number(invoice.total),
        balance: invoice.balance ? Number(invoice.balance) : 0,
        shippingCost: invoice.shippingCost ? Number(invoice.shippingCost) : 0,
        tax: invoice.tax ? Number(invoice.tax) : 0,
        discount: Number(invoice.discount ?? 0),
        hasNcf: invoice.hasNcf,
        items: (itemsMap[invoice.id] || []).map(item => ({
            ...item,
            quantity: Number(item.quantity),
            price: Number(item.price)
        }))
    }))
}

export async function getInvoiceById`);

// Replace getInvoiceById
content = content.replace(/export async function getInvoiceById\(id: string\) \{[\s\S]*?\}\n\nexport async function markAsDispatched/m, `export async function getInvoiceById(id: string) {
    await requireAuth();

    const insforge = createServerClient()

    const { data: invoice, error } = await insforge.database
        .from('Invoice')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !invoice) {
        return null
    }

    const [{ data: items }, { data: client }, { data: createdBy }, { data: dispatchInfo }] = await Promise.all([
        insforge.database.from('InvoiceItem').select('*').eq('invoiceId', id),
        invoice.clientId ? insforge.database.from('Client').select('*').eq('id', invoice.clientId).single() : Promise.resolve({ data: null }),
        invoice.createdById ? insforge.database.from('users').select('*').eq('id', invoice.createdById).single() : Promise.resolve({ data: null }),
        insforge.database.from('Dispatch').select('*').eq('invoiceId', id).single()
    ])

    let technician = null;
    if (dispatchInfo?.technicianId) {
        const res = await insforge.database.from('users').select('*').eq('id', dispatchInfo.technicianId).single()
        technician = res.data;
    }

    return {
        ...invoice,
        client: client || null,
        createdBy: createdBy || null,
        dispatchInfo: dispatchInfo ? { ...dispatchInfo, technician } : null,
        total: Number(invoice.total),
        balance: invoice.balance ? Number(invoice.balance) : 0,
        shippingCost: invoice.shippingCost ? Number(invoice.shippingCost) : 0,
        tax: invoice.tax ? Number(invoice.tax) : 0,
        discount: Number(invoice.discount ?? 0),
        hasNcf: invoice.hasNcf,
        items: (items || []).map(item => ({
            ...item,
            quantity: Number(item.quantity),
            price: Number(item.price)
        }))
    }
}

export async function markAsDispatched`);

// Replace deleteInvoice 
content = content.replace(/export async function deleteInvoice\(id: string, password\?: string\) \{[\s\S]*?if \(!invoice\) \{/m, `export async function deleteInvoice(id: string, password?: string) {
    await requireAuth();

    const user = await getCurrentUser()
    if (!user) throw new Error("Unauthorized")

    const insforge = createServerClient()

    // Get invoice with related data
    const { data: invoice } = await insforge.database
        .from('Invoice')
        .select('*')
        .eq('id', id)
        .single()

    if (!invoice) {`);
    
content = content.replace(/        \/\/ Delete WorkOrder if exists\n        if \(invoice\.workOrder\) \{/m, `        // Delete WorkOrder if exists
        const { data: workOrder } = await insforge.database.from('WorkOrder').select('id').eq('invoiceId', id).single()
        if (workOrder) {`)

content = content.replace(/        \/\/ Delete Dispatch if exists\n        if \(invoice\.dispatchInfo\) \{/m, `        // Delete Dispatch if exists
        const { data: dispatchInfo } = await insforge.database.from('Dispatch').select('id').eq('invoiceId', id).single()
        if (dispatchInfo) {`)

fs.writeFileSync(filePath, content)
console.log('Fixed actions/invoice-actions.ts')