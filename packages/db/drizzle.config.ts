import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL belum diset. Migrasi butuh koneksi langsung (bukan pooler mode transaction).',
  );
}

/**
 * Konfigurasi Drizzle Kit.
 *
 * `migrations/` sengaja terpisah dari kode aplikasi (PRD Bab 11 Prinsip Eksekusi):
 * migrasi adalah artefak deploy, bukan modul runtime. `migrate` dijalankan di CI/CD,
 * bukan otomatis saat aplikasi start.
 */
export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  verbose: true,
  strict: true,
  casing: 'snake_case',
});
