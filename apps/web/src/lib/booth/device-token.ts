/**
 * Kredensial perangkat booth: pencetakan, hashing, dan verifikasi.
 *
 * Menggantikan `DEVICE_JWT_SECRET` yang dideklarasikan tapi tidak pernah dipakai.
 * Bentuk yang dipakai di sini sengaja sempit dan tidak bergantung pada library
 * JWT: token perangkat berumur panjang (30 hari, PRD Bab 6.M), jadi yang
 * dibutuhkan adalah (a) bearer token yang tidak bisa ditebak, (b) verifikasi
 * dari hash yang tersimpan, dan (c) bisa dicabut per perangkat.
 *
 * Mengerangkai JWT tidak menambah keamanan di sini dan menambah satu
 * ketergantungan yang harus ikut dirotasi bersama kunci lain. Yang benar-benar
 * menentukan adalah hash `devices.session_jwt_hash` dan flag `devices.is_revoked`
 * — keduanya sudah ada di skema.
 *
 * ATURAN YANG TIDAK BOLEH DILANGGAR:
 * - Kredensial mentah tidak pernah disimpan. Hanya SHA-256-nya yang masuk DB.
 * - `boothId`/`tenantId` SELALU diturunkan dari baris `devices` yang cocok dengan
 *   hash, tidak pernah dari body permintaan.
 *
 * Bagian yang menyentuh skema Drizzle (verifikasi terhadap baris `devices`)
 * hidup di `device-auth.ts`. Modul ini bebas dependensi database supaya
 * `node --test` bisa mengujinya tanpa loader, dan supaya penerbitan token tidak
 * pernah butuh koneksi.
 */
import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

/** Masa berlaku token perangkat, hari (PRD Bab 6.M). */
export const DEVICE_SESSION_TTL_DAYS = 30;

/** Bentuk token: `<base64url payload>.<base64url HMAC>`; `alg` implisit dan tetap. */
const TOKEN_VERSION = 'v1';

/** Panjang token, byte acak sebelum di-encode. */
const TOKEN_BYTES = 32;

/**
 * Hash SHA-256 token, sebagai hex.
 *
 * SHA-256 (bukan scrypt seperti PIN) benar di sini karena inputnya adalah
 * string acak 256-bit, bukan tebakan manusia. Password dan PIN butuh KDF
 * lambat; token 256-bit tidak punya ruang tebakan untuk diperlambat.
 */
export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function signDeviceToken(payload: string, secret: string): string {
  return createHash('sha256').update(`${TOKEN_VERSION}.${payload}.${secret}`).digest('base64url');
}

export function deviceSecret(): string {
  const secret = process.env.DEVICE_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'DEVICE_JWT_SECRET belum diset atau terlalu pendek untuk menandatangani token perangkat.',
    );
  }
  return secret;
}

/** Token perangkat yang sudah ditandatangani. Hanya nilai ini yang dikembalikan ke klien. */
export interface IssuedDeviceToken {
  readonly token: string;
  readonly expiresAt: string;
  readonly tokenHash: string;
}

/**
 * Menerbitkan token perangkat.
 *
 * Mengembalikan hash-nya juga supaya pemanggil bisa menyimpannya dalam
 * transaksi yang sama dengan pembuatan baris `devices`, tanpa harus menghitung
 * ulang dan tanpa pernah menyentuh token mentah di sisi database.
 */
export function issueDeviceToken(nowMs: number = Date.now()): IssuedDeviceToken {
  const secret = deviceSecret();
  const raw = randomBytes(TOKEN_BYTES).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ v: TOKEN_VERSION, t: raw, iat: Math.floor(nowMs / 1000) }),
  ).toString('base64url');
  const token = `${payload}.${signDeviceToken(payload, secret)}`;
  const expiresAt = new Date(nowMs + DEVICE_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  return { token, expiresAt: expiresAt.toISOString(), tokenHash: hashDeviceToken(token) };
}
