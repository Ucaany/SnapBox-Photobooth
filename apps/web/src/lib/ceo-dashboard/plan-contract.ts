/**
 * Kontrak editor plan (PRD Task 1.5).
 *
 * Modul ini adalah trust boundary antara form editor (client) dan server
 * action `updatePlan`. Skema dipakai DUA KALI: sekali di browser untuk feedback
 * cepat, dan sekali lagi di server karena input browser tidak pernah dipercaya
 * (PRD Bab 5.5, ADR-004).
 *
 * Sumber kebenaran bentuk feature tetap `PlanFeatures` di `@snapbox/db`
 * (PRD Bab 5.3, fungsi entitlement Task 1.7). Modul ini sengaja bebas `next/*`
 * dan runtime DB supaya aman diimpor dari komponen client; tipe feature
 * diimpor sebagai type-only agar tidak menarik runtime Drizzle ke bundle.
 */
import { z } from 'zod';

import type { PlanFeatures } from '@snapbox/db';

/** Batas aman di bawah presisi kolom `numeric(12,2)`. */
const MAX_PRICE = 9_999_999_999;
/** Batas atas limit integer; `-1` khusus berarti tanpa batas (unlimited). */
const MAX_LIMIT = 100_000;
/** Nilai kanonik untuk "tanpa batas"; dipakai skema, server, dan UI. */
export const UNLIMITED_LIMIT = -1;

/** Jenis kamera kanonik; `cameraTypes` di `PlanFeatures` adalah `string[]`. */
export const CAMERA_TYPES: readonly PlanFeatures['cameraTypes'][number][] = ['WEBCAM', 'DSLR'];
export const CHROMA_KEY_LEVELS: readonly PlanFeatures['chromaKeyLevel'][] = [
  'AUTO',
  'ADVANCED',
  'MULTILAYER',
];
export const FILTER_LEVELS: readonly PlanFeatures['filterLevel'][] = [
  'BASIC',
  'ADJUST',
  'CUSTOM_LUT',
];

/**
 * Harga IDR non-negatif, maksimal dua desimal, dalam rentang kolom DB.
 *
 * Menerima string (nilai form) maupun number, lalu dinormalisasi ke string
 * desimal dua angka supaya tidak ada floating-point drift saat menulis ke
 * kolom `numeric`.
 */
export const planPriceSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (raw === '') {
    ctx.addIssue({ code: 'custom', message: 'Harga wajib diisi.' });
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
  if (!Number.isFinite(numeric) || numeric > MAX_PRICE) {
    ctx.addIssue({
      code: 'custom',
      message: `Harga maksimal ${MAX_PRICE.toLocaleString('id-ID')}.`,
    });
    return z.NEVER;
  }
  return numeric.toFixed(2);
});

/** Harga tahunan opsional; `null` berarti plan tidak menawarkan siklus tahunan. */
export const planYearlyPriceSchema = z
  .union([z.string(), z.number(), z.null()])
  .transform((value, ctx) => {
    if (value === null) return null;
    const raw = typeof value === 'number' ? String(value) : value.trim();
    if (raw === '') return null;
    const parsed = planPriceSchema.safeParse(raw);
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', message: 'Harga tahunan tidak valid.' });
      return z.NEVER;
    }
    return parsed.data;
  });

/**
 * Limit integer. Nilai `-1` berarti tanpa batas dan hanya sah pada field yang
 * mendukungnya (`unlimited: true` di metadata field).
 */
function limitSchema(unlimited: boolean) {
  return z.union([z.string(), z.number()]).transform((value, ctx) => {
    const raw = typeof value === 'number' ? String(value) : value.trim();
    if (!/^-?\d+$/.test(raw)) {
      ctx.addIssue({ code: 'custom', message: 'Gunakan bilangan bulat.' });
      return z.NEVER;
    }
    const numeric = Number(raw);
    if (!Number.isSafeInteger(numeric)) {
      ctx.addIssue({ code: 'custom', message: 'Nilai di luar rentang aman.' });
      return z.NEVER;
    }
    if (numeric === UNLIMITED_LIMIT) {
      if (!unlimited) {
        ctx.addIssue({ code: 'custom', message: 'Field ini tidak mendukung nilai tanpa batas.' });
        return z.NEVER;
      }
      return UNLIMITED_LIMIT;
    }
    if (numeric < 0 || numeric > MAX_LIMIT) {
      ctx.addIssue({ code: 'custom', message: `Nilai harus 0 sampai ${MAX_LIMIT}.` });
      return z.NEVER;
    }
    return numeric;
  });
}

export type PlanFeatureKind = 'integer' | 'boolean' | 'enum' | 'camera-list' | 'text';

/**
 * Metadata field feature untuk UI editor.
 *
 * `kind` menentukan kontrol yang dirender, `label` satu-satunya sumber teks
 * Bahasa Indonesia, dan `unlimited` menandai field yang boleh `-1`. Server tetap
 * memakai `planFeaturesSchema` sebagai penentu; metadata ini tidak melemahkan
 * validasi. Urutan array ini juga urutan render di form.
 */
export interface PlanFeatureField {
  readonly key: keyof PlanFeatures;
  readonly label: string;
  readonly kind: PlanFeatureKind;
  readonly unlimited?: boolean;
  readonly hint?: string;
  readonly options?: readonly string[];
}

export const PLAN_FEATURE_FIELDS: readonly PlanFeatureField[] = [
  { key: 'deviceIncluded', label: 'Perangkat termasuk', kind: 'integer' },
  { key: 'addOnPricePerDevice', label: 'Harga add-on per perangkat (Rp/bln)', kind: 'integer' },
  { key: 'paymentGatewayB2C', label: 'Payment gateway B2C', kind: 'boolean' },
  { key: 'backupGateway', label: 'Gateway cadangan', kind: 'boolean' },
  { key: 'cameraTypes', label: 'Jenis kamera', kind: 'camera-list', hint: 'Minimal satu jenis.' },
  { key: 'maxFrameUpload', label: 'Maksimum unggah frame', kind: 'integer', unlimited: true },
  { key: 'storageMb', label: 'Penyimpanan soft copy (MB)', kind: 'integer' },
  { key: 'retentionDays', label: 'Retensi foto (hari)', kind: 'integer' },
  { key: 'promoEnabled', label: 'Promo & voucher', kind: 'boolean' },
  { key: 'promoAdvanced', label: 'Promo lanjutan + batch', kind: 'boolean' },
  { key: 'kioskCustomEnabled', label: 'Kustomisasi kiosk', kind: 'boolean' },
  { key: 'kioskMultiplePanelStyle', label: 'Gaya panel kiosk berganda', kind: 'boolean' },
  { key: 'staffLimit', label: 'Akun staff', kind: 'integer', unlimited: true },
  { key: 'outletLimit', label: 'Outlet', kind: 'integer', unlimited: true },
  { key: 'chromaKeyLevel', label: 'Chroma key', kind: 'enum', options: CHROMA_KEY_LEVELS },
  { key: 'filterLevel', label: 'Filter', kind: 'enum', options: FILTER_LEVELS },
  { key: 'supportLevel', label: 'Dukungan', kind: 'text' },
  { key: 'priorityRealtime', label: 'Priority realtime', kind: 'boolean' },
];

const textSchema = z.string().trim().min(1).max(120);

/**
 * Skema feature lengkap.
 *
 * `.strict()` menolak key asing, sehingga field baru di `PlanFeatures` tidak
 * bisa diam-diam hilang: bila tidak ditambahkan di sini, parse akan gagal.
 */
export const planFeaturesSchema = z
  .object({
    deviceIncluded: limitSchema(false),
    addOnPricePerDevice: limitSchema(false),
    paymentGatewayB2C: z.boolean(),
    backupGateway: z.boolean(),
    cameraTypes: z
      .array(z.enum(CAMERA_TYPES))
      .min(1, 'Pilih minimal satu jenis kamera.')
      .transform((value) => Array.from(new Set(value))),
    maxFrameUpload: limitSchema(true),
    storageMb: limitSchema(false),
    retentionDays: limitSchema(false),
    promoEnabled: z.boolean(),
    promoAdvanced: z.boolean(),
    kioskCustomEnabled: z.boolean(),
    kioskMultiplePanelStyle: z.boolean(),
    staffLimit: limitSchema(true),
    outletLimit: limitSchema(true),
    chromaKeyLevel: z.enum(CHROMA_KEY_LEVELS),
    filterLevel: z.enum(FILTER_LEVELS),
    supportLevel: textSchema,
    priorityRealtime: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // Feature turunan tidak bermakna tanpa fitur induknya.
    if (value.backupGateway && !value.paymentGatewayB2C) {
      ctx.addIssue({
        code: 'custom',
        path: ['backupGateway'],
        message: 'Aktifkan gateway B2C dahulu.',
      });
    }
    if (value.promoAdvanced && !value.promoEnabled) {
      ctx.addIssue({
        code: 'custom',
        path: ['promoAdvanced'],
        message: 'Aktifkan promo dasar dahulu.',
      });
    }
    if (value.kioskMultiplePanelStyle && !value.kioskCustomEnabled) {
      ctx.addIssue({
        code: 'custom',
        path: ['kioskMultiplePanelStyle'],
        message: 'Aktifkan kustomisasi kiosk dahulu.',
      });
    }
  }) satisfies z.ZodType<PlanFeatures>;

/** Input server action `updatePlan`. `tier`/`id`/`isActive` sengaja tidak ada. */
export const planUpdateInputSchema = z
  .object({
    planId: z.string().uuid('Plan tidak valid.'),
    name: z.string().trim().min(2, 'Nama plan minimal 2 karakter.').max(100),
    priceMonthly: planPriceSchema,
    priceYearly: planYearlyPriceSchema,
    features: planFeaturesSchema,
  })
  .strict();

export type PlanUpdateInput = z.infer<typeof planUpdateInputSchema>;

/** Bentuk plan yang dikirim server component ke editor (data NYATA, bukan contoh). */
export interface EditablePlan extends Omit<PlanUpdateInput, 'planId'> {
  readonly id: string;
  readonly tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  readonly isActive: boolean;
  readonly updatedAt: string;
}

export const PLAN_ACTION_ERROR_CODES = [
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'SERVER_ERROR',
] as const;
export type PlanActionErrorCode = (typeof PLAN_ACTION_ERROR_CODES)[number];

export type PlanActionResult =
  | {
      readonly ok: true;
      readonly planId: string;
      readonly changed: readonly string[];
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly code: PlanActionErrorCode;
      readonly message: string;
      readonly fieldErrors?: Readonly<Record<string, string>>;
    };

/** Field plan non-feature yang ikut di-diff; satu sumber untuk server dan editor. */
export const PLAN_TOP_LEVEL_KEYS = ['name', 'priceMonthly', 'priceYearly'] as const;

/**
 * Diff nilai lama dan baru, dikembalikan sebagai daftar nama field yang berubah.
 *
 * Dipakai server action untuk metadata audit dan editor untuk memutuskan apakah
 * tombol simpan aktif, sehingga keduanya tidak bisa menyimpang.
 */
export function diffPlanFields(
  before: Pick<EditablePlan, 'name' | 'priceMonthly' | 'priceYearly' | 'features'>,
  after: Pick<EditablePlan, 'name' | 'priceMonthly' | 'priceYearly' | 'features'>,
): readonly string[] {
  const changed: string[] = [];

  for (const key of PLAN_TOP_LEVEL_KEYS) {
    if ((before[key] ?? '') !== (after[key] ?? '')) changed.push(key);
  }

  for (const field of PLAN_FEATURE_FIELDS) {
    const prev = before.features[field.key];
    const next = after.features[field.key];
    // Array (cameraTypes) dibandingkan sebagai himpunan: urutan bukan perubahan berarti.
    const same =
      Array.isArray(prev) && Array.isArray(next)
        ? prev.length === next.length && prev.every((item) => next.includes(item))
        : prev === next;
    if (!same) changed.push(`features.${field.key}`);
  }

  return changed;
}

/** Format angka IDR untuk pratinjau; hanya presentasi. */
export function formatRupiah(value: string | number): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(numeric);
}

/** Format limit untuk tabel ringkas: `-1` menjadi `Unlimited`. */
export function formatLimit(value: number): string {
  return value === UNLIMITED_LIMIT ? 'Unlimited' : new Intl.NumberFormat('id-ID').format(value);
}
