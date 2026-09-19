import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env'), quiet: true });

const { Pool } = pg;
export const databaseConfigured = Boolean(process.env.DATABASE_URL);

function connectionString() {
  if (!databaseConfigured) throw new Error('DATABASE_URL is not configured');
  const url = new URL(process.env.DATABASE_URL);
  if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
  // pg currently interprets sslmode=require as certificate verification unless
  // libpq compatibility is enabled. Supabase's require setting encrypts the
  // connection without requiring a downloaded project CA certificate.
  if (!url.searchParams.has('uselibpqcompat')) url.searchParams.set('uselibpqcompat', 'true');
  return url.toString();
}

export const pool = databaseConfigured ? new Pool({
  connectionString: connectionString(),
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
}) : null;

export function requireDatabase(_req, res, next) {
  if (!pool) return res.status(503).json({ error: 'Supabase is not configured. Set DATABASE_URL in .env.' });
  next();
}
