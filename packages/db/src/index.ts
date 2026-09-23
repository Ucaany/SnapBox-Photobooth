/**
 * @snapbox/db: skema Drizzle, koneksi, dan seed untuk Supabase PostgreSQL.
 *
 * Re-export `schema` supaya pemanggil cukup `import { tenants } from '@snapbox/db'`,
 * sementara tooling migrasi tetap membaca `./src/schema.ts` secara langsung.
 */
export * from './client';
export * from './schema';
