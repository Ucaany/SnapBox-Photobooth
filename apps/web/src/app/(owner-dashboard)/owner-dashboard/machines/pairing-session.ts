/**
 * Penerbitan sesi pairing booth (PRD Bab 6.B + ADR-001).
 *
 * Bukan server action: modul ini menerima transaksi Drizzle dari pemanggil
 * supaya pembuatan booth + sesi pairing dan regenerasi kode dapat berjalan
 * atomik. Kode mentah hanya hidup di dalam return value; yang tersimpan di DB
 * hanyalah hash SHA-256.
 */
import 'server-only';

import { and, eq } from 'drizzle-orm';

import { pairingTokens, type Database } from '@snapbox/db';

import { PAIRING_TTL_MS, hashPairingCode, newPairingCode } from '@/lib/booth/pairing-token';

export { PAIRING_TTL_MS };

export interface IssuedPairingSession {
  readonly expiresAt: string;
  /** Kode QR sekali pakai; hanya dikembalikan ke pemanggil, tidak disimpan. */
  readonly sessionCode: string;
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

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

  const code = newPairingCode();
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
