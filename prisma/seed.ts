import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config()

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding...')

    // Seed default Users
    await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            name: 'Administrador Principal',
            username: 'admin',
            password: 'admin', // Default
            role: 'ADMIN'
        }
    })

    await prisma.user.upsert({
        where: { username: 'venta' },
        update: {},
        create: {
            name: 'Vendedor Turno 1',
            username: 'venta',
            password: '2025',
            role: 'SELLER'
        }
    })

    await prisma.user.upsert({
        where: { username: 'contador' },
        update: {},
        create: {
            name: 'Contador General',
            username: 'contador',
            password: '2025',
            role: 'ACCOUNTANT'
        }
    })

    // Create Clients
    // We cannot upsert clients easily without a unique field other than ID, but we can check existence or skip if error.
    // For simplicity in seeding, we will try to find first.

    let client1 = await prisma.client.findFirst({ where: { rnc: '130000000' } })
    if (!client1) {
        client1 = await prisma.client.create({
            data: {
                name: 'Empresa Demo SRL',
                rnc: '130000000',
                address: 'Av. Winston Churchill 101, SD',
                phone: '809-555-0101',
                email: 'contacto@empresademo.com',
            },
        })
    }

    // Create Products
    const products = []
    for (let i = 1; i <= 10; i++) {
        const sku = `SKU-${1000 + i}`
        const product = await prisma.product.upsert({
            where: { sku },
            update: {},
            create: {
                name: `Producto Demo ${i}`,
                description: `Descripcion del producto ${i}`,
                price: 100 * i,
                stock: 50,
                sku,
                category: 'ARTICULO'
            },
        })
        products.push(product)
    }

    // Create Service
    const service = await prisma.product.upsert({
        where: { sku: 'SRV-INSTALL' },
        update: {},
        create: {
            name: 'Servicio de Instalacion',
            description: 'Mano de obra',
            price: 2500,
            isService: true,
            stock: 0,
            sku: 'SRV-INSTALL',
            category: 'SERVICIO'
        },
    })

    // Create Default Invoice if none exist
    const invoiceCount = await prisma.invoice.count()
    if (invoiceCount === 0 && client1) {
        await prisma.invoice.create({
            data: {
                clientId: client1.id,
                clientName: client1.name,
                total: 10500,
                status: 'PAID',
                paymentMethod: 'TRANSFER',
                items: {
                    create: [
                        { productId: products[0].id, productName: products[0].name, quantity: 5, price: 100 },
                        { productId: service.id, productName: service.name, quantity: 4, price: 2500 }
                    ]
                }
            }
        })
    }

    console.log('Seeding finished.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
