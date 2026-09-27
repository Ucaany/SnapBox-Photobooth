/**
 * Session cookie SnapBox: envelope bertanda tangan HMAC-SHA256.
 *
 * Mengapa envelope bertanda tangan, bukan JWT Firebase langsung sebagai cookie:
 *
 * 1. `firebase-admin` tidak bisa berjalan di Edge runtime, sedangkan
 *    `middleware.ts` WAJIB Edge (PRD Bab 8.2 baris 813). Middleware karena itu
 *    tidak boleh memverifikasi ID token sendiri.
 * 2. Cookie yang menyimpan ID token mentah akan kedaluwarsa dalam 1 jam dan
 *    tidak membawa ringkasan otorisasi (role/tenant/subscription) yang
 *    dibutuhkan gate rute.
 *
 * Karena itu route server memverifikasi ID token Firebase lewat Admin SDK,
 * membaca DB, lalu menerbitkan envelope ini. Isi envelope adalah SNAPSHOT, bukan
 * sumber kebenaran: middleware hanya memakainya untuk gate awal (redirect),
 * sementara server action / route handler / layout privat WAJIB mengulang
 * pemeriksaan ke DB (`getSession()` + query).
 *
 * Berkas ini sengaja hanya memakai API Web Crypto (`crypto.subtle`) dan
 * `TextEncoder`/`TextDecoder` yang tersedia di Node 22 DAN Edge runtime,
 * sehingga implementasi tanda tangan di kedua runtime identik. Tidak ada
 * `node:crypto`, tidak ada Buffer, tidak ada import `next/*`.
 */
import { z } from 'zod';

import { userRoleSchema } from '@snapbox/shared/domain';
import { subscriptionStatusSchema } from '@snapbox/shared/domain';

import { parseEnv, sessionEnvSchema } from '@snapbox/shared/env';

/** Nama cookie sesi. Dipakai middleware, route auth, dan logout. */
export const SESSION_COOKIE_NAME = 'snapbox_session';

/** Masa berlaku sesi. Lebih pendek dari Firebase refresh token, sengaja. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * Snapshot status langganan untuk gate rute.
 *
 * `UNKNOWN` dan `BLOCKED` sengaja dibedakan: `UNKNOWN` berarti tenant tidak
 * punya langganan yang bisa dievaluasi (mis. CEO, atau data belum dimigrasi),
 * sedangkan `BLOCKED` berarti hasil pemeriksaan eksplisit menolak. Gate tetap
 * menolak keduanya untuk OWNER/STAFF, tetapi pemanggil bisa membedakan pesan.
 */
export const SUBSCRIPTION_GATES = ['OK', 'UNKNOWN', 'BLOCKED'] as const;
export const subscriptionGateSchema = z.enum(SUBSCRIPTION_GATES);
export type SubscriptionGate = z.infer<typeof subscriptionGateSchema>;

/**
 * Isi envelope sesi.
 *
 * `firebaseUid` disimpan agar server bisa memverifikasi ulang token ke Firebase
 * bila perlu. ID token sendiri TIDAK PERNAH masuk cookie.
 */
export const sessionPayloadSchema = z.object({
  /** Stable server-side session identity used for revocation. */
  sessionId: z.string().uuid(),
  /** ID baris `users.id` (UUID). */
  userId: z.string().uuid(),
  /** UID Firebase; dipakai untuk verifikasi ulang ke Admin SDK. */
  firebaseUid: z.string().min(1).max(128),
  email: z.string().email(),
  role: userRoleSchema,
  tenantId: z.string().uuid().nullable(),
  parentTenantId: z.string().uuid().nullable(),
  subscription: subscriptionGateSchema,
  /** Status langganan mentah, untuk pesan UI; bukan keputusan otorisasi. */
  subscriptionStatus: subscriptionStatusSchema.nullable(),
  /** Waktu terbit, detik Unix. */
  iat: z.number().int().nonnegative(),
  /** Kedaluwarsa, detik Unix. */
  exp: z.number().int().nonnegative(),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

/** Bagian payload yang diisi pemanggil; `iat`/`exp` dihitung `createSession`. */
export type SessionInput = Omit<SessionPayload, 'iat' | 'exp' | 'sessionId'> & {
  sessionId?: string;
};

/**
 * Env kunci penandatangan cookie sesi, dibaca malas supaya modul ini bisa
 * diimpor di runtime yang belum tentu punya env (mis. unit test) selama
 * tanda tangan tidak dipakai.
 *
 * @throws Error bila `SESSION_COOKIE_SECRET` hilang/tidak 32 byte base64.
 */
function getSecretEnv() {
  const env = parseEnv(sessionEnvSchema, {
    SESSION_COOKIE_SECRET: process.env.SESSION_COOKIE_SECRET,
    SESSION_COOKIE_SECRET_PREVIOUS: process.env.SESSION_COOKIE_SECRET_PREVIOUS,
    SESSION_COOKIE_INSECURE_DEV: process.env.SESSION_COOKIE_INSECURE_DEV,
  });

  if (!env.success || !env.data) {
    throw new Error(
      `SESSION_COOKIE_SECRET belum diset atau tidak valid. Salin .env.example lalu jalankan "openssl rand -base64 32". Rincian: ${env.message ?? '(tidak diketahui)'}`,
    );
  }

  return env.data;
}

/** Panjang kunci HMAC yang diharapkan, byte. */
const KEY_LENGTH_BYTES = 32;

/** Panjang `kid` dalam karakter base64url, yaitu 48 bit. */
const KID_LENGTH = 8;

/** Satu kunci penandatangan beserta identitasnya. */
interface SigningKey {
  readonly kid: string;
  readonly key: CryptoKey;
}

/** Satu pasangan kunci yang sah untuk satu instance. */
interface KeyRing {
  readonly current: SigningKey;
  /** Kunci lama, dipetakan lewat `kid`; tidak pernah dipakai untuk menandatangani. */
  readonly previous: ReadonlyMap<string, SigningKey>;
}

/**
 * Cache kunci HMAC, di-*invalidasi* oleh nilai secret, bukan oleh identitas
 * instance.
 *
 *_detection_ rotasi harus membandingkan nilai secret, bukan objek `CryptoKey`:
 * kunci turunan selalu objek baru, sehingga perbandingan objek tidak pernah
 * mendeteksi apa pun. `rotationFingerprint` menggabungkan SEMUA secret yang
 * relevan, jadi penambahan/penghapusan kunci lama juga tercatat.
 */
let cachedRotation: string | null = null;
let cachedRing: KeyRing | null = null;

async function importKey(secret: string): Promise<SigningKey> {
  // `atob` mengabaikan karakter setelah yang pertama tidak valid, jadi panjang
  // hasil decode diperiksa eksplisit: kunci pendek berarti entropi berkurang,
  // dan itu harus gagal, bukan diam-diam dipakai.
  const keyBytes = Uint8Array.from(atob(secret), (char) => char.charCodeAt(0));
  if (keyBytes.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `SESSION_COOKIE_SECRET harus base64 dari tepat ${KEY_LENGTH_BYTES} byte (256-bit).`,
    );
  }

  const digest = await crypto.subtle.digest('SHA-256', keyBytes);

  return {
    kid: toBase64Url(new Uint8Array(digest)).slice(0, KID_LENGTH),
    key: await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
      'verify',
    ]),
  };
}

async function getKeyRing(): Promise<KeyRing> {
  const { SESSION_COOKIE_SECRET, SESSION_COOKIE_SECRET_PREVIOUS } = getSecretEnv();

  const previous = SESSION_COOKIE_SECRET_PREVIOUS.split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const rotationFingerprint = `${SESSION_COOKIE_SECRET}|${previous.join(',')}`;
  if (cachedRing && cachedRotation === rotationFingerprint) {
    return cachedRing;
  }

  const retired = await Promise.all(previous.map((secret) => importKey(secret)));

  const ring: KeyRing = {
    current: await importKey(SESSION_COOKIE_SECRET),
    // `Map` dari pasangan `[kid, kunci]`. Satu kunci bisa diulang di daftar
    // hanya kalau nilainya sama persis, jadi menuliskannya dua kali aman.
    previous: new Map(retired.map((entry) => [entry.kid, entry])),
  };

  cachedRotation = rotationFingerprint;
  cachedRing = ring;

  return ring;
}

/** base64url tanpa padding, bentuk aman untuk nama cookie dan URL. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode base64url; `null` bila bentuknya tidak sah. */
function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Menandatangani payload JSON menjadi `kid.payload.signature`.
 *
 * Prefix `kid` ada supaya rotasi `SESSION_COOKIE_SECRET` tidak merusak sesi yang
 * sedang berjalan. Tanpa prefix, satu instance yang sudah memegang kunci baru
 * akan menolak cookie yang ditandatangani instance yang masih memegang kunci
 * lama, dan pengguna terjebak loop redirect `/login` ↔ dashboard selama deploy
 * bergulir. Mitigasi lama untuk ini cuma catatan prosedural ("jangan rotasi di
 * tengah deploy"), dan catatan prosedural bukan kontrol.
 *
 * `kid` ditandatangani juga, jadi penyerang tidak bisa menukar `kid` untuk
 * mengarahkan verifikasi ke kunci lain.
 *
 * @param payload Isi sesi yang sudah lengkap dengan `iat`/`exp`.
 * @throws Error bila `SESSION_COOKIE_SECRET` tidak valid.
 */
export async function signSession(payload: SessionPayload): Promise<string> {
  const { current } = await getKeyRing();
  const body = `${current.kid}.${toBase64Url(encoder.encode(JSON.stringify(payload)))}`;
  const signature = await crypto.subtle.sign('HMAC', current.key, encoder.encode(body));

  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * Memverifikasi dan mengurai cookie sesi.
 *
 * Gagal tertutup: cookie hilang, bentuk rusak, `kid` tak dikenal, tanda tangan
 * salah, payload tidak sesuai skema, atau sudah kedaluwarsa semuanya menghasilkan
 * `null`. Pemanggil memperlakukan `null` sebagai anonymous, bukan error.
 *
 * Bentuk yang diterima:
 * - `kid.payload.signature` — bentuk sekarang. `kid` harus ada di keyring
 *   instance ini; `kid` tak dikenal DITOLAK, bukan diabaikan.
 * - `payload.signature` — bentuk lama tanpa `kid`. Tetap diterima, dicoba
 *   terhadap kunci saat ini lalu setiap kunci lama, supaya cookie yang sudah
 *   terbit sebelum deploy tidak langsung menggugurkan semua pengguna. Bentuk ini
 *   tidak pernah dihasilkan lagi oleh `signSession`.
 *
 * @param raw Nilai cookie mentah, biasanya `request.cookies.get(...)`.
 */
export async function verifySession(
  raw: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!raw) return null;

  // Bentuk legacy `payload.signature` tidak punya `kid` untuk dicocokkan, jadi
  // `kid` null dan semua kunci menjadi kandidat. Bentuk sekarang menanggungkan
  // `kid` di dalam teks yang ditandatangani, sehingga menukarnya mustahil
  // tanpa mengetahui secret.
  const segments = raw.split('.');
  const legacy = segments.length === 2;
  if (!legacy && segments.length !== 3) return null;

  const kid = legacy ? null : (segments[0] ?? '');
  const payloadPart = legacy ? (segments[0] ?? '') : (segments[1] ?? '');
  const body = legacy ? payloadPart : `${kid}.${payloadPart}`;
  const signature = fromBase64Url(segments[segments.length - 1] ?? '');
  if (!signature) return null;

  let ring: KeyRing;
  try {
    ring = await getKeyRing();
  } catch {
    // Secret hilang/tidak valid: verifikasi tidak bisa dilakukan, jadi tolak.
    return null;
  }

  // Kandidat kunci. Untuk bentuk legacy semua kunci dicoba; jumlahnya kecil dan
  // dibatasi env.
  const candidates = legacy
    ? [ring.current, ...ring.previous.values()]
    : [kid === ring.current.kid ? ring.current : ring.previous.get(kid ?? '')].filter(
        (entry): entry is SigningKey => entry !== undefined,
      );

  if (candidates.length === 0) return null;

  let valid = false;
  for (const candidate of candidates) {
    try {
      if (
        await crypto.subtle.verify(
          'HMAC',
          candidate.key,
          signature as BufferSource,
          encoder.encode(body),
        )
      ) {
        valid = true;
        break;
      }
    } catch {
      return null;
    }
  }
  if (!valid) return null;

  // `payloadPart` adalah payload JSON dalam base64url; bentuk sekarang
  // menambah `kid.` di depannya, dan `kid` itu ikut ditandatangani.
  const json = fromBase64Url(payloadPart);
  if (!json) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(decoder.decode(json));
  } catch {
    return null;
  }

  const parsed = sessionPayloadSchema.safeParse(decoded);
  if (!parsed.success) return null;

  // Cek kedaluwarsa di sini juga supaya middleware tidak bisa lupa.
  if (parsed.data.exp <= Math.floor(Date.now() / 1000)) return null;

  return parsed.data;
}

/**
 * Membuat cookie sesi siap dipasang.
 *
 * Atribut keamanan ada di satu tempat supaya tidak ada route yang lupa
 * `HttpOnly`/`SameSite`. `Secure` hanya di production agar dev di `http://`
 * localhost tetap bisa login.
 *
 * @param input Isi sesi tanpa `iat`/`exp`; keduanya dihitung di sini.
 * @param nowMs Waktu sekarang, dapat diganti untuk test.
 */
export async function createSession(
  input: SessionInput,
  nowMs: number = Date.now(),
): Promise<{ name: string; value: string; maxAge: number }> {
  const issuedAt = Math.floor(nowMs / 1000);
  const payload: SessionPayload = sessionPayloadSchema.parse({
    ...input,
    sessionId: input.sessionId ?? crypto.randomUUID(),
    iat: issuedAt,
    exp: issuedAt + SESSION_MAX_AGE_SECONDS,
  });

  return {
    name: SESSION_COOKIE_NAME,
    value: await signSession(payload),
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * Atribut `Set-Cookie` terpusat.
 *
 * `SameSite=Lax` sesuai PRD Bab 8.2 (CSRF Next.js built-in + Lax), `HttpOnly`
 * mencegah akses JS, `Path=/` agar seluruh rute mengirimkannya.
 *
 * `Secure` TIDAK lagi bergantung pada `NODE_ENV`. Dulu `NODE_ENV === 'production'`
 * berarti preview dan staging — yang memang sering menjalankan
 * `NODE_ENV=production` di belakang hostname lain — menerima cookie tanpa
 * `Secure`, sehingga bisa direplay lewat HTTP. Sekarang `Secure` aktif kecuali
 * ada opt-out eksplisit `SESSION_COOKIE_INSECURE_DEV=1`, yang hanya berguna
 * untuk `http://localhost` saat pengembangan. Cara opt-outnya dicatat sebagai
 * perintah di `docs/ENVIRONMENT-AND-SECRETS.md`.
 */
export function sessionCookieOptions(maxAge: number) {
  let insecureDev = false;
  try {
    insecureDev = getSecretEnv().SESSION_COOKIE_INSECURE_DEV.trim() === '1';
  } catch {
    // Env belum lengkap: `Secure` tetap aktif, karena mengaktifkannya adalah
    // perilaku benar di setiap runtime. `sessionCookieOptions` tidak boleh
    // melemahkan kontrol hanya karena env belum dimuat.
  }

  return {
    httpOnly: true,
    secure: !insecureDev,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
