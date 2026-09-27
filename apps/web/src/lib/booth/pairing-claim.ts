/**
 * Klaim atomik token pairing (PRD Bab 6.B).
 *
 * Dipisah dari `pairing-token.ts` karena modul ini menyentuh skema Drizzle,
 * yang tidak bisa dimuat `node --test` tanpa loader. Pemisahan ini juga
 *_matches_ batas tanggung jawab: `pairing-token.ts`+T3Miss owns "apa itu token
 * pairing", berkas ini memiliki "bagaimana token itu diklaim secara atomik".
 */
import 'server-only';

import { and, eq, gt, sql } from 'drizzle-orm';

import { pairingTokens, type Database } from '@snapbox/db';

import { PAIRING_MAX_ATTEMPTS } from './pairing-token';

/**
 * Client Drizzle atau transaction, supaya insert `devices` bisa ikut transaksi
 * yang sama dengan klaim.
 */
export type PairingClaimClient = {
  update: Database['update'];
};

/**
 * Mengklaim token pairing: memvalidasi DAN mengonsumsi dalam SATU pernyataan.
 *
 *   UPDATE pairing_tokens
 *      SET used = true, used_at = $2, attempt_count = attempt_count + 1
 *    WHERE code_hash = $1 AND used = false
 *      AND expires_at > $2 AND attempt_count < $3
 *  RETURNING booth_id, tenant_id
 *
 * Kenapa harus satu pernyataan. Membaca `used` lalu menulisnya di belakang
 * memberi dua permintaan bersamaan dua-duanya membaca `used = false`, lalu
 * dua-duanya menulis `used = true` — dan keduanya mengembalikan baris. Redo
 * Postgres (BEGIN ... COMMIT pada transaksi yang sama) wokenya ada persis untuk
 * mencegah ini, dan leveling single-use di atasnya berarti kita tidak boleh
 * bergantung pada kode aplikasi yang rapi.
 *
 * Nol baris dikembalikan berarti: kode salah, sudah dipakai, kedaluwarsa, atau
 * sudah habis percobaan. Keempatnya sengaja TIDAK dibedakan di respons.
 *
 * @returns `booth_id`/`tenant_id` dari token, atau `null` bila klaim gagal.
 */
export async function claimPairingToken(
  client: PairingClaimClient,
  input: { codeHash: string; now: Date },
): Promise<{ boothId: string; tenantId: string } | null> {
  const [row] = await client
    .update(pairingTokens)
    .set({
      used: true,
      usedAt: input.now,
      attemptCount: sql`${pairingTokens.attemptCount} + 1`,
    })
    .where(
      and(
        eq(pairingTokens.codeHash, input.codeHash),
        eq(pairingTokens.used, false),
        gt(pairingTokens.expiresAt, input.now),
        sql`${pairingTokens.attemptCount} < ${PAIRING_MAX_ATTEMPTS}`,
      ),
    )
    .returning({ boothId: pairingTokens.boothId, tenantId: pairingTokens.tenantId });

  return row ?? null;
}

/**
 * Mencatat percobaan penukaran yang gagal.
 *
 * Syarat `used = false` membuat dua permintaan bersamaan tidak menghitung dua
 * kali: begitu satu klaim berhasil, `used` sudah `true` dan baris ini tidak lagi
 * cocok. TokEN yang `expires_at`-nya sudah lewat juga tidak dihitung, karena
 * kadaluarsa sudah menutupnya secara permanen.
 */
export async function recordFailedPairingAttempt(
  client: PairingClaimClient,
  input: { codeHash: string; now: Date },
): Promise<void> {
  await client
    .update(pairingTokens)
    .set({ attemptCount: sql`${pairingTokens.attemptCount} + 1` })
    .where(
      and(
        eq(pairingTokens.codeHash, input.codeHash),
        eq(pairingTokens.used, false),
        gt(pairingTokens.expiresAt, input.now),
      ),
    );
}
