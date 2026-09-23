/**
 * Skema environment SnapBox (PRD Bab 10.14).
 *
 * Satu sumber kebenaran untuk variabel lingkungan. Modul ini dipisah per
 * trust boundary supaya secret server tidak pernah ikut ke bundle client:
 *
 * - `publicEnvSchema`  : aman untuk browser, wajib prefix `NEXT_PUBLIC_`.
 * - `serverEnvSchema`  : HANYA server (Firebase Admin, Supabase service role, DB).
 * - `secretEnvSchema`  : kunci enkripsi + signing, tidak pernah dikirim ke mana pun.
 * - `thirdPartyEnvSchema`: kredensial vendor, server-only.
 *
 * Validasi dijalankan saat modul di-import (`parseEnv`) sehingga misconfiguration
 * gagal cepat saat boot, bukan saat request pertama masuk.
 */
import { z } from 'zod';

/** Helper: string kosong dari `.env` dianggap tidak diisi. */
const nonEmpty = z.string().trim().min(1);

const urlLike = z.string().url();

/**
 * Variabel yang boleh masuk bundle browser.
 * DILARANG menambahkan apa pun tanpa prefix `NEXT_PUBLIC_` (PRD Bab 8.2).
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: urlLike,
  NEXT_PUBLIC_SUPABASE_URL: urlLike,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty,
  NEXT_PUBLIC_FIREBASE_API_KEY: nonEmpty,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: nonEmpty,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: nonEmpty,
  NEXT_PUBLIC_FIREBASE_APP_ID: nonEmpty,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: nonEmpty.optional(),
  NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: nonEmpty.optional(),
  NEXT_PUBLIC_SENTRY_DSN: urlLike.optional(),
});

/** Variabel server-only: akses database, auth admin, dan service role. */
export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty,
  FIREBASE_ADMIN_PROJECT_ID: nonEmpty,
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email(),
  FIREBASE_ADMIN_PRIVATE_KEY: nonEmpty,
});

/**
 * Kunci kriptografi. Nilai wajib base64 dari 32 byte acak (AES-256).
 * Rotasi mengikuti PRD Bab 10.16 ADR-003 (per kuartal).
 */
const base64Key32 = z
  .string()
  .trim()
  .refine(
    (value) => {
      try {
        return Buffer.from(value, 'base64').length === 32;
      } catch {
        return false;
      }
    },
    { message: 'Harus base64 dari tepat 32 byte (256-bit).' },
  );

export const secretEnvSchema = z.object({
  ENCRYPTION_MASTER_KEY: base64Key32,
  PAIRING_TOKEN_SECRET: base64Key32,
  LAN_JWT_SECRET: base64Key32,
  DEVICE_JWT_SECRET: base64Key32,
});

/** Kredensial vendor pihak ketiga. Server-only, rotasi per kuartal. */
export const thirdPartyEnvSchema = z.object({
  PAKASIR_B2B_API_KEY: nonEmpty,
  PAKASIR_B2B_WEBHOOK_SECRET: nonEmpty,
  RESEND_API_KEY: nonEmpty,
  RESEND_FROM_EMAIL: nonEmpty,
  SENTRY_AUTH_TOKEN: nonEmpty.optional(),
  SENTRY_ORG: nonEmpty.optional(),
  SENTRY_PROJECT: nonEmpty.optional(),
  CLOUDFLARE_API_TOKEN: nonEmpty.optional(),
  CLOUDFLARE_ZONE_ID: nonEmpty.optional(),
  TURNSTILE_SECRET_KEY: nonEmpty.optional(),
  WHATSAPP_SALES_NUMBER: nonEmpty,
});

/** Kredensial B2C per-tenant tidak lewat env: disimpan terenkripsi di DB (ADR-003). */
export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type SecretEnv = z.infer<typeof secretEnvSchema>;
export type ThirdPartyEnv = z.infer<typeof thirdPartyEnvSchema>;

/** Lingkungan runtime yang dikenali aplikasi. */
export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');
export type NodeEnv = z.infer<typeof nodeEnvSchema>;

export interface ParseEnvResult<T> {
  readonly success: boolean;
  readonly data?: T;
  /** Pesan siap-tampil; sengaja TIDAK memuat nilai variabel agar secret tidak bocor ke log. */
  readonly message?: string;
}

/**
 * Memvalidasi sekumpulan env terhadap skema Zod tanpa pernah membocorkan nilai.
 *
 * @param schema Skema Zod yang dipakai.
 * @param source Objek env mentah (biasanya `process.env`).
 * @returns Hasil parse berisi data bertipe atau pesan error yang aman dilog.
 */
export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, string | undefined>,
): ParseEnvResult<z.infer<T>> {
  const result = schema.safeParse(source);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const message = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');

  return { success: false, message };
}
