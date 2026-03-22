import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

const dbClientSingleton = () => {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;

  const client = postgres(connectionString, {
    prepare: false,
  });

  const dbInstance = drizzle(client, { schema });

  // Log connection info for debugging purposes
  if (process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL;
    const maskedUrl = url.replace(/:([^:@]+)@/, ':****@');
    console.log(`[Drizzle] Connected to: ${maskedUrl}`);
  } else {
    console.warn('[Drizzle] No DATABASE_URL environment variable found.');
  }

  return dbInstance;
};

type DbClientSingleton = ReturnType<typeof dbClientSingleton>;

const globalForDb = globalThis as unknown as {
  db: DbClientSingleton | undefined;
};

export const db = globalForDb.db ?? dbClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}
