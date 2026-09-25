/**
 * Kontrak promo global CEO (PRD Task 1.10, Bab 6.F).
 *
 * Modul ini adalah trust boundary antara form editor (client) dan server action
 * `promos/actions.ts`. Skema dipakai DUA KALI: sekali di browser untuk umpan
 * balik cepat, dan sekali lagi di server karena input browser tidak pernah
 * dipercaya (PRD Bab 5.5, ADR-004).
 *
 * Sumber kebenaran bentuk data tetap tabel `promos` di `@snapbox/db`. Modul ini
 * bebas `next/*` dan runtime DB supaya aman diimpor dari komponen client; tipe
 * DB diimpor sebagai type-only agar Drizzle tidak masuk bundel klien.
 *
 * Aturan yang dikunci di sini (PRD Bab 6.F):
 * - kode case-insensitive, alfanumerik ASCII 4-20 karakter, dinormalisasi
 *   uppercase supaya unique index database tidak bergantung casing,
 * - tipe `PERCENTAGE` bernilai 0 < value <= 100, `FIXED_AMOUNT` bernilai positif,
 * - `quotaTotal` kosong berarti tanpa batas (unlimited),
 * - periode `validFrom` harus lebih awal dari `validUntil`.
 */
import { z } from 'zod';

import type { PromoType } from '@snapbox/shared';

/** Batas di bawah presisi kolom `numeric(12,2)`. */
export const MAX_PROMO_VALUE = 9_999_999_999;
/** Batas kuota integer; menjaga nilai tetap di rentang aman JS. */
export const MAX_PROMO_QUOTA = 1_000_000;
/** Panjang kode kanonik menurut PRD Bab 6.F. */
export const PROMO_CODE_MIN = 4;
export const PROMO_CODE_MAX = 20;
/** Batas panjang kolom `promos.name`. */
export const PROMO_NAME_MAX = 150;

/** Jenis promo kanonik; cermin `PROMO_TYPES` di `@snapbox/shared`. */
export const PROMO_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT'] as const satisfies readonly PromoType[];

export const PROMO_TYPE_LABELS: Readonly<Record<PromoType, string>> = {
  PERCENTAGE: 'Persentase',
  FIXED_AMOUNT: 'Nominal tetap',
};

/**
 * Normalisasi kode voucher.
 *
 * Case-insensitive dan hanya alfanumerik ASCII. Satu fungsi dipakai skema,
 * server action, dan editor supaya query pencarian dan unique index selalu
 * membandingkan bentuk yang sama.
 */
export function normalizePromoCode(value: string): string {
  return value.trim().toUpperCase();
}

/** Kode kanonik; pesan sengaja menyebut aturan, bukan hanya "invalid". */
export const promoCodeSchema = z
  .string()
  .transform((value) => normalizePromoCode(value))
  .refine((value) => /^[A-Z0-9]+$/.test(value), {
    message: 'Kode hanya boleh huruf dan angka tanpa spasi atau simbol.',
  })
  .refine((value) => value.length >= PROMO_CODE_MIN && value.length <= PROMO_CODE_MAX, {
    message: `Kode harus ${PROMO_CODE_MIN}-${PROMO_CODE_MAX} karakter.`,
  });

/** Nama promo opsional; string kosong dinormalkan menjadi `null`. */
export const promoNameSchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    const trimmed = (value ?? '').trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((value) => value === null || value.length <= PROMO_NAME_MAX, {
    message: `Nama maksimal ${PROMO_NAME_MAX} karakter.`,
  });

/**
 * Nominal diskon.
 *
 * Menerima string (nilai form) maupun number, dinormalisasi ke string desimal
 * dua angka agar tidak ada floating-point drift saat menulis kolom `numeric`.
 * Rentang akhirnya bergantung `type` dan diperiksa di `promoInputSchema`.
 */
export const promoValueSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (raw === '') {
    ctx.addIssue({ code: 'custom', message: 'Nilai diskon wajib diisi.' });
    return z.NEVER;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Gunakan angka tanpa pemisah ribuan, maksimal 2 desimal.',
    });
    return z.NEVER;
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > MAX_PROMO_VALUE) {
    ctx.addIssue({ code: 'custom', message: 'Nilai diskon harus lebih dari 0.' });
    return z.NEVER;
  }
  return numeric.toFixed(2);
});

/** Minimum pembelian; kosong sama dengan 0. */
export const promoMinPurchaseSchema = z
  .union([z.string(), z.number(), z.null()])
  .transform((value, ctx) => {
    const raw = value === null ? '' : typeof value === 'number' ? String(value) : value.trim();
    if (raw === '') return '0.00';
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Minimum pembelian harus angka tanpa pemisah ribuan.',
      });
      return z.NEVER;
    }
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric > MAX_PROMO_VALUE) {
      ctx.addIssue({ code: 'custom', message: 'Minimum pembelian terlalu besar.' });
      return z.NEVER;
    }
    return numeric.toFixed(2);
  });

/** Kuota total; `null`/kosong berarti tanpa batas (unlimited). */
export const promoQuotaTotalSchema = z
  .union([z.string(), z.number(), z.null()])
  .transform((value, ctx) => {
    const raw = value === null ? '' : typeof value === 'number' ? String(value) : value.trim();
    if (raw === '') return null;
    if (!/^\d+$/.test(raw)) {
      ctx.addIssue({ code: 'custom', message: 'Kuota harus bilangan bulat atau dikosongkan.' });
      return z.NEVER;
    }
    const numeric = Number(raw);
    if (!Number.isSafeInteger(numeric) || numeric < 1 || numeric > MAX_PROMO_QUOTA) {
      ctx.addIssue({ code: 'custom', message: `Kuota harus 1 sampai ${MAX_PROMO_QUOTA}.` });
      return z.NEVER;
    }
    return numeric;
  });

/** Kuota per customer; minimal 1 agar kode tidak pernah bebas dipakai berulang. */
export const promoQuotaPerCustomerSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const raw = typeof value === 'number' ? String(value) : value.trim();
    if (!/^\d+$/.test(raw)) {
      ctx.addIssue({ code: 'custom', message: 'Kuota per customer harus bilangan bulat.' });
      return z.NEVER;
    }
    const numeric = Number(raw);
    if (!Number.isSafeInteger(numeric) || numeric < 1 || numeric > MAX_PROMO_QUOTA) {
      ctx.addIssue({
        code: 'custom',
        message: `Kuota per customer harus 1 sampai ${MAX_PROMO_QUOTA}.`,
      });
      return z.NEVER;
    }
    return numeric;
  });

/** Timestamp dari input `datetime-local` atau ISO; dinormalkan ke ISO UTC. */
export const promoTimestampSchema = z.string().transform((value, ctx) => {
  const raw = value.trim();
  const parsed = new Date(raw);
  if (raw === '' || Number.isNaN(parsed.getTime())) {
    ctx.addIssue({ code: 'custom', message: 'Tanggal tidak valid.' });
    return z.NEVER;
  }
  return parsed.toISOString();
});

/**
 * Field yang membentuk satu promo.
 *
 * `tenantId`, `isGlobal`, `quotaUsed`, `boothScope`, dan `packageScope` TIDAK
 * ada di sini: promo global selalu `tenantId = null` + `isGlobal = true`,
 * sedangkan `quotaUsed` hanya berubah lewat redemption engine (task terpisah).
 */
const promoFieldsSchema = z
  .object({
    name: promoNameSchema,
    code: promoCodeSchema,
    type: z.enum(PROMO_TYPES),
    value: promoValueSchema,
    minPurchase: promoMinPurchaseSchema,
    validFrom: promoTimestampSchema,
    validUntil: promoTimestampSchema,
    quotaTotal: promoQuotaTotalSchema,
    quotaPerCustomer: promoQuotaPerCustomerSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === 'PERCENTAGE' && Number(value.value) > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Diskon persentase maksimal 100.',
      });
    }
    if (new Date(value.validFrom).getTime() >= new Date(value.validUntil).getTime()) {
      ctx.addIssue({
        code: 'custom',
        path: ['validUntil'],
        message: 'Berakhir harus setelah mulai.',
      });
    }
  });

export const promoCreateInputSchema = promoFieldsSchema;

/**
 * Input update. `promoId` wajib; `quotaUsed` dikirim server (bukan dari body)
 * lewat `minQuotaUsed` supaya kuota tidak bisa diturunkan di bawah pemakaian.
 */
export const promoUpdateInputSchema = promoFieldsSchema.safeExtend({
  promoId: z.string().uuid('Promo tidak valid.'),
  quotaUsed: z.number().int().min(0),
});

export type PromoCreateInput = z.infer<typeof promoCreateInputSchema>;
export type PromoUpdateInput = z.infer<typeof promoUpdateInputSchema>;

/** Input toggle aktif/nonaktif; hanya id + nilai target. */
export const promoToggleInputSchema = z
  .object({
    promoId: z.string().uuid('Promo tidak valid.'),
    isActive: z.boolean(),
  })
  .strict();

/** Input nonaktifkan (soft delete); alasan dicatat di audit. */
export const promoDeleteInputSchema = z
  .object({
    promoId: z.string().uuid('Promo tidak valid.'),
    reason: z.string().trim().min(4, 'Alasan minimal 4 karakter.').max(2000),
  })
  .strict();

export type PromoToggleInput = z.infer<typeof promoToggleInputSchema>;
export type PromoDeleteInput = z.infer<typeof promoDeleteInputSchema>;

/** Status turunan untuk tampilan; TIDAK disimpan di DB. */
export const PROMO_DISPLAY_STATUSES = ['Aktif', 'Terjadwal', 'Berakhir', 'Nonaktif'] as const;
export type PromoDisplayStatus = (typeof PROMO_DISPLAY_STATUSES)[number];

/**
 * Hitung status tampilan dari tiga fakta kanonik.
 *
 * Nonaktif lebih kuat dari periode: promo yang dimatikan manual tetap terbaca
 * nonaktif walau jadwalnya masih berjalan.
 */
export function derivePromoStatus(
  isActive: boolean,
  validFrom: string,
  validUntil: string,
  now: Date = new Date(),
): PromoDisplayStatus {
  if (!isActive) return 'Nonaktif';
  const start = new Date(validFrom).getTime();
  const end = new Date(validUntil).getTime();
  const time = now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 'Nonaktif';
  if (time < start) return 'Terjadwal';
  if (time >= end) return 'Berakhir';
  return 'Aktif';
}

/** Baris promo yang dikirim server component ke editor (data NYATA). */
export interface PromoRow {
  readonly id: string;
  readonly name: string | null;
  readonly code: string;
  readonly type: PromoType;
  readonly value: string;
  readonly minPurchase: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly quotaTotal: number | null;
  readonly quotaUsed: number;
  readonly quotaPerCustomer: number;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly status: PromoDisplayStatus;
}

/** Diff dibandingkan pada nilai kanonik, bukan pada bentuk input mentah. */
const DIFF_KEYS = [
  'name',
  'code',
  'type',
  'value',
  'minPurchase',
  'validFrom',
  'validUntil',
  'quotaTotal',
  'quotaPerCustomer',
] as const;

/** Daftar field yang berubah, dipakai audit dan tombol simpan editor. */
export function diffPromoFields(
  before: Pick<PromoRow, (typeof DIFF_KEYS)[number]>,
  after: Pick<PromoRow, (typeof DIFF_KEYS)[number]>,
): readonly string[] {
  const changed: string[] = [];
  for (const key of DIFF_KEYS) {
    if ((before[key] ?? null) !== (after[key] ?? null)) changed.push(key);
  }
  return changed;
}

/** Format nilai diskon untuk tabel: `15%` atau `Rp 10.000`. */
export function formatPromoValue(type: PromoType, value: string | number): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '-';
  if (type === 'PERCENTAGE') {
    return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(numeric)}%`;
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(numeric);
}

/** Format kuota: `3 / 100` atau `3 / Tanpa batas`. */
export function formatPromoQuota(used: number, total: number | null): string {
  const usedLabel = new Intl.NumberFormat('id-ID').format(used);
  if (total === null) return `${usedLabel} / Tanpa batas`;
  return `${usedLabel} / ${new Intl.NumberFormat('id-ID').format(total)}`;
}

export const PROMO_ACTION_ERROR_CODES = [
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'CONFLICT',
  'SERVER_ERROR',
] as const;
export type PromoActionErrorCode = (typeof PROMO_ACTION_ERROR_CODES)[number];

export type PromoActionResult =
  | { readonly ok: true; readonly promoId: string; readonly message: string }
  | {
      readonly ok: false;
      readonly code: PromoActionErrorCode;
      readonly message: string;
      readonly fieldErrors?: Readonly<Record<string, string>>;
    };

/** Alias nama lama; `PromoRow` adalah bentuk kanonik baris editor. */
export type EditablePromo = PromoRow;

/**
 * Peta issue Zod ke field error stabil; nilai pertama untuk satu path menang.
 *
 * Dipakai server action; editor memakai salinan kecil fungsi ini agar modul ini
 * tetap bebas dari runtime form.
 */
export function fieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[issue.path.join('.') || 'form'] ??= issue.message;
  return errors;
}
