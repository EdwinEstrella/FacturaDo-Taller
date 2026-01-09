import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Testing DB Connection...')
    try {
        const userCount = await prisma.user.count()
        console.log(`Connection successful. User count: ${userCount}`)

        const admin = await prisma.user.findFirst({ where: { username: 'admin' } })
        console.log('Admin user found:', admin?.username, admin?.password)
    } catch (e) {
        console.error('DB Connection Failed:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
