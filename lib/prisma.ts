import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>

const globalForPrisma = globalThis as unknown as {
  prisma_v3: PrismaClientSingleton | undefined
}

export const prisma = globalForPrisma.prisma_v3 ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma_v3 = prisma
}

// Log connection info for debugging purposes (especially in Electron)
// Note: This relies on the environment variable being set correctly.
if (process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  const maskedUrl = url.replace(/:([^:@]+)@/, ':****@');
  console.log(`[Prisma] Connected to: ${maskedUrl}`);
} else {
  console.warn('[Prisma] No DATABASE_URL environment variable found.');
}
