/**
 * Kontrak token pairing booth (PRD Bab 6.B, ADR-001).
 *
 * Dipisah supaya penerbitan (`pairing-session.ts`) dan penukaran
 * (`/api/booth/pair`) memakai SATU definisi hash dan SATU ambang percobaan.
 * Dua implementasi hash yang berbeda akan menghasilkan dua tabel token yang
 * tidak saling mengenali — dan karena tidak ada yang salah secara visual, hash
 * yang salah hanya muncul sebagai "kode selalu ditolak" di produksi.
 *
 * Berkas ini SENGAJA tanpa impor apa pun: parts of the pairing chain that need
 * the Drizzle schema live in `pairing-claim.ts`, dan menjaga modul ini bebas
 * dependensi berarti `node --test` bisa mengujinya tanpa loader dan tanpa
 * database.
 */

import { createHash, randomBytes } from 'node:crypto';

/** Masa berlaku token pairing, 10 menit (PRD Bab 6.B). */
export const PAIRING_TTL_MS = 10 * 60 * 1000;

/**
 * Panjang kode pairing, byte acak (±24 karakter base64url).
 *
 * 18 byte = 144 bit. Cukup besar sehingga tebakan tidak realistis; batas
 * percobaan di bawah ada untuk kode yang sudah bocor, bukan untuk tebakan.
 */
const PAIRING_CODE_BYTES = 18;

/**
 * Ambang percobaan sebelum token terkunci permanen.
 *
 * Setelah ambang ini tercapai, `attempt_count` membuat token tidak dapat
 * ditebus walau kodenya benar, dan Owner harus menerbitkan kode baru. Nilainya
 * dijaga di sini supaya penerbitan dan penukaran tidak punya angka berbeda.
 */
export const PAIRING_MAX_ATTEMPTS = 5;

/** Kode pairing mentah. Hanya hidup di respons; yang tersimpan adalah hash-nya. */
export function newPairingCode(): string {
  return randomBytes(PAIRING_CODE_BYTES).toString('base64url');
}

/** Hash SHA-256 kode pairing, hex. Satu-satunya definisi di repo ini. */
export function hashPairingCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
