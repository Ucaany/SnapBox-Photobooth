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
export type SessionInput = Omit<SessionPayload, 'iat' | 'exp'>;

/**
 * Secret HMAC. Dibaca malas (lazy) supaya modul ini bisa diimpor di runtime
 * yang belum tentu punya env (mis. unit test) selama tanda tangan tidak dipakai.
 *
 * @throws Error bila `SESSION_COOKIE_SECRET` hilang/tidak 32 byte base64.
 */
function getSecret(): string {
  const env = parseEnv(sessionEnvSchema, {
    SESSION_COOKIE_SECRET: process.env.SESSION_COOKIE_SECRET,
  });

  if (!env.success || !env.data) {
    throw new Error(
      `SESSION_COOKIE_SECRET belum diset atau tidak valid. Salin .env.example lalu jalankan "openssl rand -base64 32". Rincian: ${env.message ?? '(tidak diketahui)'}`,
    );
  }

  return env.data.SESSION_COOKIE_SECRET;
}

/** Panjang kunci HMAC yang diharapkan, byte. */
const KEY_LENGTH_BYTES = 32;

/**
 * Cache kunci HMAC.
 *
 * Secret mentah disimpan bersama kunci turunannya supaya rotasi
 * `SESSION_COOKIE_SECRET` terdeteksi. Tanpa ini, instance yang sudah panas akan
 * terus memakai kunci lama: cookie yang ditandatangani instance baru ditolak
 * instance lama sehingga pengguna terjebak loop redirect `/login` ↔ dashboard
 * selama deploy bergulir.
 */
let cachedSecret: string | null = null;
let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  const secret = getSecret();

  // `atob` mengabaikan karakter setelah yang pertama tidak valid, jadi panjang
  // hasil decode diperiksa eksplisit: kunci pendek berarti entropi berkurang,
  // dan itu harus gagal, bukan diam-diam dipakai.
  const keyBytes = Uint8Array.from(atob(secret), (char) => char.charCodeAt(0));
  if (keyBytes.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `SESSION_COOKIE_SECRET harus base64 dari tepat ${KEY_LENGTH_BYTES} byte (256-bit).`,
    );
  }

  if (cachedKey && cachedSecret === secret) {
    return cachedKey;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );

  cachedSecret = secret;
  cachedKey = key;

  return key;
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
 * Menandatangani payload JSON menjadi `payload.signature`.
 *
 * @param payload Isi sesi yang sudah lengkap dengan `iat`/`exp`.
 * @throws Error bila `SESSION_COOKIE_SECRET` tidak valid.
 */
export async function signSession(payload: SessionPayload): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await getKey(), encoder.encode(body));

  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * Memverifikasi dan mengurai cookie sesi.
 *
 * Gagal tertutup: cookie hilang, bentuk rusak, tanda tangan salah, payload tidak
 * sesuai skema, atau sudah kedaluwarsa semuanya menghasilkan `null`. Pemanggil
 * memperlakukan `null` sebagai anonymous, bukan error.
 *
 * @param raw Nilai cookie mentah, biasanya `request.cookies.get(...)`.
 */
export async function verifySession(
  raw: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!raw) return null;

  const separator = raw.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = raw.slice(0, separator);
  const signature = fromBase64Url(raw.slice(separator + 1));
  if (!signature) return null;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      await getKey(),
      signature as BufferSource,
      encoder.encode(body),
    );
  } catch {
    // Secret hilang/tidak valid: verifikasi tidak bisa dilakukan, jadi tolak.
    return null;
  }
  if (!valid) return null;

  const json = fromBase64Url(body);
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
 */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
