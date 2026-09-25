/**
 * Hash PIN operator booth.
 *
 * PIN adalah kredensial bersama sebuah booth (PRD Bab 6.H: "Staff login via PIN
 * operator, 6 digit, generate Owner"), bukan kata sandi akun. Karena itu
 * penyimpanannya tetap WAJIB memakai KDF yang lambat: PIN 6 digit hanya punya
 * 1.000.000 kemungkinan, sehingga hash cepat (MD5/SHA-*) bisa di-brute-force
 * penuh dalam hitungan detik.
 *
 * Format tersimpan (satu kolom varchar(128) di `booths.operator_pin_hash`):
 *
 * ```
 * scrypt$<N>$<r>$<p>$<salt-base64url>$<key-base64url>
 * ```
 *
 * Parameter ditulis di dalam string supaya verifikasi lama tidak rusak bila
 * parameter default naik di kemudian hari. Tidak ada plaintext yang pernah
 * disimpan, dicatat, atau dikembalikan.
 *
 * Berkas ini memakai `node:crypto`, jadi HANYA boleh diimpor dari route/helper
 * server dengan `runtime = 'nodejs'`. Middleware Edge TIDAK boleh menyentuhnya.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** Parameter biaya default. Naikkan bila perangkat server memungkinkan. */
export const PIN_SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

/** Panjang kunci turunan dan salt, byte. */
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

/** Algoritma yang dikenali. Satu string skema, bukan daftar fleksibel. */
const SCHEME = 'scrypt';

/** PIN operator sesuai PRD: tepat 6 digit. */
export const PIN_PATTERN = /^\d{6}$/;

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function fromBase64Url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
}

/**
 * Membuat hash PIN baru untuk disimpan Owner.
 *
 * Semua parameter ditulis eksplisit di string hash, sehingga verifikasi tidak
 * bergantung pada konstanta modul saat ini.
 *
 * @param pin PIN 6 digit.
 * @throws Error bila PIN tidak sesuai pola.
 */
export function hashPin(pin: string): string {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error('PIN operator harus tepat 6 digit.');
  }

  const { N, r, p } = PIN_SCRYPT_PARAMS;
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(pin, salt, KEY_LENGTH, { N, r, p });

  // Urutan: skema, N, r, p, salt, key. Dipisah `$` agar mudah diperluas.
  return [SCHEME, N, r, p, toBase64Url(salt), toBase64Url(derived)].join('$');
}

/**
 * Memverifikasi PIN terhadap hash tersimpan.
 *
 * Gagal tertutup: format hash tidak dikenali, parameter di luar batas aman, atau
 * salt/key rusak semuanya mengembalikan `false` tanpa melempar. Perbandingan
 * memakai `timingSafeEqual` supaya waktu eksekusi tidak membocorkan berapa
 * banyak byte awal yang cocok.
 *
 * @param pin PIN 6 digit dari form.
 * @param storedHash Nilai `booths.operator_pin_hash`.
 */
export function verifyPin(pin: string, storedHash: string | null): boolean {
  if (!PIN_PATTERN.test(pin)) return false;
  if (!storedHash) return false;

  const parts = storedHash.split('$');
  if (parts.length !== 6) return false;

  const [scheme, nRaw, rRaw, pRaw, saltRaw, keyRaw] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  if (scheme !== SCHEME) return false;

  const N = Number.parseInt(nRaw, 10);
  const r = Number.parseInt(rRaw, 10);
  const p = Number.parseInt(pRaw, 10);

  // Batasi parameter: hash dengan N raksasa bisa dipakai untuk DoS, dan N kecil
  // berarti hash lemah. Di luar jendela wajar = tidak dipercaya.
  if (!Number.isInteger(N) || N < 4096 || N > 1 << 20) return false;
  if (!Number.isInteger(r) || r < 1 || r > 32) return false;
  if (!Number.isInteger(p) || p < 1 || p > 16) return false;

  const salt = fromBase64Url(saltRaw);
  const expected = fromBase64Url(keyRaw);
  if (!salt || !expected || expected.length !== KEY_LENGTH) return false;

  let derived: Buffer;
  try {
    derived = scryptSync(pin, salt, expected.length, { N, r, p });
  } catch {
    return false;
  }

  if (derived.length !== expected.length) return false;

  return timingSafeEqual(derived, expected);
}
