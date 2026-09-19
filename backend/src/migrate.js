import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

if (!pool) {
  console.error('Set DATABASE_URL in .env before running db:migrate.');
  process.exitCode = 1;
} else {
  try {
    const file = resolve(dirname(fileURLToPath(import.meta.url)), '../sql/schema.sql');
    await pool.query(await readFile(file, 'utf8'));
    console.log('Supabase tables and indexes are ready.');
  } catch (error) {
    console.error(`Database migration failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
