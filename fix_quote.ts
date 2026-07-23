import fs from 'fs'

const filePath = 'actions/quote-actions.ts'
let content = fs.readFileSync(filePath, 'utf8')

// Add pre-validation to convertQuoteToInvoice
const convertCode = `export async function convertQuoteToInvoice(quoteId: string) {
    await requireAuth();
    const quote = await getQuoteById(quoteId)

    if (!quote) return { success: false, error: "Cotización no encontrada" }

    const insforge = createServerClient()

    try {
        // Pre-validate stock before touching the database
        for (const item of quote.items) {
            if (!item.productId) continue;
            const { data: product } = await insforge.database.from('Product').select('stock, name, isService').eq('id', item.productId).single();
            if (!product) throw new Error("Producto no encontrado: " + item.productName);
            
            if (item.variantId) {
                const { data: variant } = await insforge.database.from('ProductVariant').select('stock, name').eq('id', item.variantId).single();
                if (!variant) throw new Error("Variante no encontrada: " + item.productName);
                if (Number(variant.stock || 0) < item.quantity) {
                    throw new Error(\`Stock insuficiente para variante \${item.productName}. Disponible: \${variant.stock}\`);
                }
            } else if (!product.isService) {
                if (Number(product.stock || 0) < item.quantity) {
                    throw new Error(\`Stock insuficiente para \${product.name}. Disponible: \${product.stock}\`);
                }
            }
        }

        const { data: invoice, error: invoiceError } = await insforge.database`

content = content.replace(/export async function convertQuoteToInvoice\(quoteId: string\) \{[\s\S]*?const \{ data: invoice, error: invoiceError \} = await insforge\.database/m, convertCode)

fs.writeFileSync(filePath, content)