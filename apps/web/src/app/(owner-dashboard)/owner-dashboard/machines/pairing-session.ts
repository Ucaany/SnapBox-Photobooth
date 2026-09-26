/**
 * Penerbitan sesi pairing booth (PRD Bab 6.B + ADR-001).
 *
 * Bukan server action: modul ini menerima transaksi Drizzle dari pemanggil
 * supaya pembuatan booth + sesi pairing dan regenerasi kode dapat berjalan
 * atomik. Kode mentah hanya hidup di dalam return value; yang tersimpan di DB
 * hanyalah hash SHA-256.
 */
import { createHash, randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';

import { pairingTokens, type Database } from '@snapbox/db';

/** Masa berlaku sesi pairing, 10 menit (PRD Bab 6.B). */
export const PAIRING_TTL_MS = 10 * 60 * 1000;

/** Panjang kode sesi (URL-safe base64, ±24 karakter). */
const SESSION_CODE_BYTES = 18;

export interface IssuedPairingSession {
  readonly expiresAt: string;
  /** Kode QR sekali pakai; hanya dikembalikan ke pemanggil, tidak disimpan. */
  readonly sessionCode: string;
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

function hashPairingCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * Menonaktifkan token booth ini yang belum terpakai, lalu menyisipkan baris
 * baru. Token adalah single-use + scoped booth, jadi mengganti sesi harus
 * membatalkan sesi lama.
 *
 * @returns Waktu kedaluwarsa (ISO) dan kode manual untuk ditampilkan sekali.
 */
export async function insertPairingSession(
  tx: Tx,
  input: { tenantId: string; boothId: string; userId: string | null },
): Promise<IssuedPairingSession> {
  await tx
    .update(pairingTokens)
    .set({ used: true, usedAt: new Date() })
    .where(
      and(
        eq(pairingTokens.boothId, input.boothId),
        eq(pairingTokens.tenantId, input.tenantId),
        eq(pairingTokens.used, false),
      ),
    );

  const code = randomBytes(SESSION_CODE_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);

  await tx.insert(pairingTokens).values({
    tenantId: input.tenantId,
    boothId: input.boothId,
    codeHash: hashPairingCode(code),
    manualCode: null, // PRD: server hanya menyimpan hash; kode mentah dikembalikan sekali.
    expiresAt,
    createdByUserId: input.userId,
  });

  return { expiresAt: expiresAt.toISOString(), sessionCode: code };
}
