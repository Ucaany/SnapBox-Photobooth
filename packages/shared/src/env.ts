/**
 * Skema environment SnapBox (PRD Bab 10.14).
 *
 * Satu sumber kebenaran untuk variabel lingkungan. Modul ini dipisah per
 * trust boundary supaya secret server tidak pernah ikut ke bundle client:
 *
 * - `publicEnvSchema`  : aman untuk browser, wajib prefix `NEXT_PUBLIC_`.
 * - `serverEnvSchema`  : HANYA server (Firebase Admin, Supabase service role, DB).
 * - `sessionEnvSchema` : kunci penandatangan cookie sesi; dipakai server DAN edge
 *                        middleware, jadi BUKAN bagian `secretEnvSchema` yang
 *                        dikonsumsi `node:crypto`.
 * - `secretEnvSchema`  : kunci enkripsi + signing, tidak pernah dikirim ke mana pun.
 * - `thirdPartyEnvSchema`: kredensial vendor, server-only.
 *
 * Validasi bersifat LAZY per call site lewat `parseEnv`: tidak ada proses boot
 * yang mem-parsing apa pun, sehingga misconfiguration baru muncul saat variabel
 * itu benar-benar dipakai (request atau eksekusi pertama), bukan saat boot.
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
  NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: nonEmpty.optional(),
  NEXT_PUBLIC_SENTRY_DSN: urlLike.optional(),
  /**
   * Nomor WhatsApp sales untuk CTA landing publik. Dibaca langsung oleh
   * komponen CTA WhatsApp di client, jadi tidak mungkin lewat env server.
   * Sengaja duplikat dari `WHATSAPP_SALES_NUMBER` sisi server: dua prefix, satu
   * konsep, dan hanya yang berprefix `NEXT_PUBLIC_` yang punya konsumen.
   */
  NEXT_PUBLIC_SALES_WHATSAPP: nonEmpty.optional(),
});

/** Variabel server-only: akses database, auth admin, dan service role. */
export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  /** Optional direct connection used by Drizzle CLI; runtime uses DATABASE_URL. */
  DIRECT_URL: z.string().url().optional(),
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
  SESSION_COOKIE_SECRET: base64Key32,
});

/**
 * Kunci penandatangan cookie sesi web.
 *
 * Dipisah dari `secretEnvSchema` karena dua alasan. Pertama, verifikator edge
 * (`apps/web/src/middleware.ts`) hanya boleh memakai API Web Crypto, sehingga
 * ia butuh skema tanpa import `node:*` apa pun. Kedua, verifikator yang sama
 * tidak memerlukan secret enkripsi lain (kunci enkripsi, signing LAN, dsb),
 * jadi menaruhnya di `secretEnvSchema` akan memaksa middleware memvalidasi
 * variabel yang tidak dipakainya.
 *
 * Nilai WAJIB base64 dari tepat 32 byte acak agar entropi HMAC-SHA256 terjamin.
 * Jangan pernah jatuh ke default: verifikasi harus gagal tertutup, bukan gagal
 * terbuka.
 */
export const sessionEnvSchema = z.object({
  SESSION_COOKIE_SECRET: base64Key32,
  /**
   * Kunci lama yang MASIH HARUS diterima saat verifikasi, dipisah koma.
   *
   * Ada supaya rotasi kunci tidak menjadiONEY: pada deploy bergulir, sebagian
   * instance memegang kunci baru dan sebagian masih yang lama. Tanpa daftar ini,
   * cookie yang ditandatangani satu kelompok ditolak kelompok lain dan pengguna
   * terjebak loop redirect `/login` ↔ dashboard. Kunci di sini hanya dipakai
   * untuk MEMVERIFIKASI; cookie baru selalu ditandatangani `SESSION_COOKIE_SECRET`.
   *
   * Kosong berarti tidak ada kunci lama — nilai default yang benar, bukan
   * fallback longgar.
   */
  SESSION_COOKIE_SECRET_PREVIOUS: z.string().default(''),
  /**
   * Opt-out eksplisit untuk `Secure` pada cookie sesi, khusus pengembangan
   * lokal di `http://localhost`.
   *
   * Sengaja BUKAN `NODE_ENV`: preview dan staging sering menjalankan
   * `NODE_ENV=production` di belakang hostname lain, dan `NODE_ENV` membuat
   * mereka menerima cookie tanpa `Secure` yang bisa direplay lewat HTTP. Hanya
   * nilai persis `1` yang menonaktifkan, jadi salah ketik tidak melumpuhkan
   * kontrol.
   */
  SESSION_COOKIE_INSECURE_DEV: z.string().default(''),
});

/**
 * Skema KHUSUS verifikasi signature webhook Pakasir.
 *
 * Pisah ini lahir dari satu bug nyata (BE-026). `readPakasirConfig()` memvalidasi
 * SELURUH `thirdPartyEnvSchema` sebelum membaca `webhookSecret`, dan skema itu
 * mensyaratkan `WHATSAPP_SALES_NUMBER` non-kosong. Sekali variabel yang sama
 * tidak terisi — karena unrelated dengan pembayaran — `readPakasirConfig()`
 * melempar, `verifyPakasirSignature` menangkap dan mengembalikan `false`, dan
 * SETIAP webhook pembayaran membalas 401. Tidak ada log, tidak ada error, tidak
 * ada yang tahu: variabel yang tidak menyangkut tanda tangan Decidepilih siapa
 * yang tidak boleh masuk.
 *
 * Verifikasi signature hanya butuh satu hal. Skema ini karena itu berisi tepat
 * satu kunci, dan tidak akan pernah diperluas: bila suatu saat butuh kunci lagi,
 * mintalah di sini secara sadar, bukan dengan menarik seluruh skema vendor.
 */
export const pakasirWebhookEnvSchema = z.object({
  PAKASIR_B2B_WEBHOOK_SECRET: nonEmpty,
});
export type PakasirWebhookEnv = z.infer<typeof pakasirWebhookEnvSchema>;

/**
 * Kredensial vendor pihak ketiga. Server-only, rotasi per kuartal.
 */
export const thirdPartyEnvSchema = z.object({
  PAKASIR_B2B_API_KEY: nonEmpty,
  PAKASIR_B2B_WEBHOOK_SECRET: nonEmpty,
  /** Base URL API Pakasir B2B. WAJIB HTTPS dan tanpa path endpoint; itu dipaksakan
   *  oleh adapter, bukan oleh skema ini. Saat ini masih dibaca lewat
   *  `process.env` mentah, makanya opsional di sini. */
  PAKASIR_B2B_API_URL: nonEmpty.optional(),
  RESEND_API_KEY: nonEmpty,
  RESEND_FROM_EMAIL: nonEmpty,
  /** Penerima email dukungan owner. Harus alamat email sungguhan; bentuknya
   *  divalidasi di call site (`resend.ts`), bukan di skema ini. */
  SUPPORT_EMAIL: nonEmpty.optional(),
  SENTRY_AUTH_TOKEN: nonEmpty.optional(),
  SENTRY_ORG: nonEmpty.optional(),
  SENTRY_PROJECT: nonEmpty.optional(),
  CLOUDFLARE_API_TOKEN: nonEmpty.optional(),
  CLOUDFLARE_ZONE_ID: nonEmpty.optional(),
  /** Trio secret telemetry. Dibaca dari `process.env` oleh route telemetry dan
   *  gagal tertutup dengan 503 saat kosong. Validasi base64-32 dilakukan di call
   *  site, bukan di skema ini. */
  TELEMETRY_HASH_SALT: nonEmpty.optional(),
  WAF_INGEST_SECRET: nonEmpty.optional(),
  HEARTBEAT_SECRET: nonEmpty.optional(),
  WHATSAPP_SALES_NUMBER: nonEmpty,
});
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
