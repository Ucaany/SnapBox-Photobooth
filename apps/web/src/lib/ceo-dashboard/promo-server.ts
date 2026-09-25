/**
 * Utilitas server promo global (PRD Task 1.10).
 *
 * Semua akses DB dan keputusan otorisasi untuk modul promo CEO ada di sini agar
 * server action tetap tipis. Modul ini HANYA untuk server: ia menarik
 * `@snapbox/db` dan `next/headers` (lewat `requireCeo`).
 *
 * Aturan yang mengikat:
 * - Otorisasi diulang ke DB setiap aksi (ADR-004); snapshot cookie bisa basi.
 * - Hanya promo global (`isGlobal = true`, `tenantId IS NULL`) yang boleh dibaca
 *   atau diubah dari route CEO. Promo milik tenant adalah domain Owner dan
 *   diperlakukan `NOT_FOUND` di sini agar keberadaannya tidak bocor.
 */
import { and, desc, eq, isNull } from 'drizzle-orm';

import { getDatabase, promos } from '@snapbox/db';

import { derivePromoStatus, type PromoRow } from './promo-contract';
import { TenantServerError } from './tenant-server';

/** Bentuk row `promos` yang dipakai server. */
export type PromoRecord = typeof promos.$inferSelect;

/**
 * Apakah satu row adalah promo global.
 *
 * Promo global selalu `tenantId = null` dan `isGlobal = true`. Keduanya
 * diperiksa: baris platform lama dengan salah satu flag salah tetap dianggap
 * bukan global.
 */
export function isGlobalPromo(row: PromoRecord): boolean {
  return row.isGlobal && row.tenantId === null;
}

/** Normalisasi row DB ke bentuk serializable untuk editor. */
export function toPromoRow(row: PromoRecord): PromoRow {
  const validFrom = row.validFrom.toISOString();
  const validUntil = row.validUntil.toISOString();

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    type: row.type,
    // Kolom numeric dikembalikan string oleh driver; pertahankan presisinya.
    value: String(row.value),
    minPurchase: String(row.minPurchase),
    validFrom,
    validUntil,
    quotaTotal: row.quotaTotal,
    quotaUsed: row.quotaUsed,
    quotaPerCustomer: row.quotaPerCustomer,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    status: derivePromoStatus(row.isActive, validFrom, validUntil),
  };
}

/** Semua promo global, terbaru lebih dulu. */
export async function listGlobalPromos(): Promise<readonly PromoRow[]> {
  const rows = await getDatabase()
    .select()
    .from(promos)
    .where(and(eq(promos.isGlobal, true), isNull(promos.tenantId)))
    .orderBy(desc(promos.createdAt));

  return rows.map(toPromoRow);
}

/**
 * Promo global berdasarkan id untuk mutasi.
 *
 * Id yang tidak ada, bukan UUID valid, atau bukan promo global semuanya menjadi
 * `NOT_FOUND` yang sama sehingga keberadaan promo tenant tidak bocor.
 *
 * @throws {TenantServerError} `NOT_FOUND` bila promo bukan global/tidak ada.
 */
export async function getGlobalPromoForUpdateOr404(promoId: string): Promise<PromoRecord> {
  const [row] = await getDatabase().select().from(promos).where(eq(promos.id, promoId)).limit(1);

  if (!row || !isGlobalPromo(row)) {
    throw new TenantServerError('NOT_FOUND', 'Promo tidak ditemukan.');
  }

  return row;
}

/**
 * Cek kode kanonik yang sudah dipakai promo lain.
 *
 * Sejak kode selalu uppercase, perbandingan `eq` cukup; fungsi unik `lower(code)`
 * di database tetap menjadi jaring kedua.
 */
export async function findPromoByCode(code: string, exceptPromoId?: string) {
  const db = getDatabase();
  const rows = await db
    .select({ id: promos.id, code: promos.code })
    .from(promos)
    .where(eq(promos.code, code))
    .limit(5);

  return rows.find((row) => row.id !== exceptPromoId) ?? null;
}

export { TenantServerError };

/** Tag audit untuk aksi promo global. */
export const PROMO_AUDIT_ACTIONS = {
  create: 'promo.create',
  update: 'promo.update',
  toggle: 'promo.toggle',
  delete: 'promo.delete',
} as const;
