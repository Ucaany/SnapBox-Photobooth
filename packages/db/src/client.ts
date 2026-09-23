/**
 * Koneksi database SnapBox.
 *
 * Dipisah dari `schema.ts` supaya modul skema bisa di-import oleh tooling
 * (drizzle-kit, test) tanpa membuka koneksi jaringan.
 *
 * Catatan runtime: Next.js dev me-reload modul berkali-kali, jadi koneksi
 * disimpan di `globalThis` agar tidak membuat pool baru setiap reload.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export type Database = ReturnType<typeof createDatabase>;

interface DatabaseGlobal {
  __snapboxSql?: ReturnType<typeof postgres>;
}

const globalForDb = globalThis as unknown as DatabaseGlobal;

/**
 * Membuat instance Drizzle baru di atas koneksi `postgres.js`.
 *
 * @param connectionString URL koneksi PostgreSQL. Default `process.env.DATABASE_URL`.
 * @param options.max Jumlah maksimum koneksi dalam pool. Default 10.
 * @throws Error bila `DATABASE_URL` tidak tersedia.
 */
export function createDatabase(connectionString?: string, options: { max?: number } = {}) {
  const url = connectionString ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'DATABASE_URL belum diset. Salin .env.example ke .env.local lalu isi nilainya.',
    );
  }

  const sql =
    globalForDb.__snapboxSql ??
    postgres(url, {
      max: options.max ?? 10,
      // Supabase Pooler sudah menangani pooling; siapkan koneksi idle agar
      // tidak menahan slot saat instance serverless di-scale down.
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.__snapboxSql = sql;
  }

  return drizzle(sql, { schema, casing: 'snake_case' });
}

/**
 * Mengambil instance database bersama. Aman dipanggil berulang.
 */
export function getDatabase(): Database {
  return createDatabase();
}

/** Menutup pool koneksi. Dipakai saat shutdown dan di akhir skrip seed. */
export async function closeDatabase(): Promise<void> {
  const sql = globalForDb.__snapboxSql;
  if (sql) {
    await sql.end({ timeout: 5 });
    delete globalForDb.__snapboxSql;
  }
}
