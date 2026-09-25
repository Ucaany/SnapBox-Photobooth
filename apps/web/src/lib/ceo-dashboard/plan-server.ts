/**
 * Utilitas server editor plan (PRD Task 1.5).
 *
 * Semua akses DB dan keputusan otorisasi untuk modul plan ada di sini agar
 * server action tetap tipis. Modul ini HANYA untuk server: ia menarik
 * `@snapbox/db` dan `next/headers` (lewat `requireCeo`).
 *
 * Otorisasi diulang ke DB setiap aksi (ADR-004); snapshot cookie bisa basi.
 */
import { eq } from 'drizzle-orm';

import { getDatabase, plans } from '@snapbox/db';

import { TenantServerError, requireCeo } from './tenant-server';
import type { EditablePlan } from './plan-contract';

/** Urutan tier kanonik untuk tampilan editor (bukan urutan harga). */
const TIER_ORDER = { STARTER: 0, GROWTH: 1, ENTERPRISE: 2 } as const;

/** Bentuk row `plans` yang sudah dinormalisasi untuk editor. */
export function toEditablePlan(row: typeof plans.$inferSelect): EditablePlan {
  return {
    id: row.id,
    tier: row.tier,
    name: row.name,
    // Kolom numeric dikembalikan sebagai string; pertahankan presisinya.
    priceMonthly: String(row.priceMonthly),
    priceYearly: row.priceYearly === null ? null : String(row.priceYearly),
    features: row.features,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Semua plan (aktif dan nonaktif) untuk editor, urut tier kanonik. */
export async function listPlansForEditor(): Promise<readonly EditablePlan[]> {
  const rows = await getDatabase().select().from(plans);
  return rows.map(toEditablePlan).sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
}

/**
 * Plan untuk update berdasarkan id.
 *
 * Validasi UUID dilakukan di kontrak; di sini id yang tidak ada menjadi
 * `NOT_FOUND` agar keberadaan plan tidak bocor lewat perbedaan respons.
 *
 * @throws {TenantServerError} `NOT_FOUND` bila plan tidak ada.
 */
export async function getPlanForUpdateOr404(planId: string) {
  const [row] = await getDatabase().select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!row) throw new TenantServerError('NOT_FOUND', 'Plan tidak ditemukan.');
  return row;
}

export { requireCeo, TenantServerError };
