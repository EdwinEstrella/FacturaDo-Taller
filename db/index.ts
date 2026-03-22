import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Use direct URL for Drizzle (not pooler) to avoid prepared statement issues
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  prepare: false,
});

export const db = drizzle(client, { schema });
