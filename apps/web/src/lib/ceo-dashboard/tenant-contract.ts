/**
 * Kontrak provisioning tenant (PRD Task 1.4).
 *
 * Modul ini adalah trust boundary antara wizard/detail (client) dan server
 * action. Skema di sini dipakai DUA KALI: sekali di browser untuk validasi
 * langkah agar UX cepat, dan sekali lagi di server action karena input dari
 * browser tidak pernah dipercaya (PRD Bab 5.5, ADR-004).
 *
 * Modul sengaja bebas `next/*`, DB, dan SDK apa pun supaya aman diimpor dari
 * komponen client.
 */
import { z } from 'zod';

import { planTierSchema, tenantStatusSchema } from '@snapbox/shared/domain';

/** Nama tenant minimal 2 karakter; angka murni ditolak di langkah review. */
export const companyNameSchema = z.string().trim().min(2).max(200);

/** Email diperlakukan sebagai identifier owner; normalisasi ke huruf kecil. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Masukkan alamat email yang valid.')
  .max(255);

/** Nomor telepon opsional, digit dan pemisah umum saja. */
export const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .regex(/^[+0-9 ()-]*$/, 'Nomor telepon hanya boleh berisi angka dan pemisah.')
  .optional()
  .or(z.literal('').transform(() => undefined));

export const addressSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal('').transform(() => undefined));

export const ownerNameSchema = z.string().trim().min(2).max(150);

/**
 * Durasi langganan yang ditawarkan wizard.
 *
 * `monthly` dan `yearly` adalah nilai wire; label dan perhitungan tanggalnya
 * ada di `tenant-server.ts` supaya tidak ada dua perhitungan yang berbeda.
 */
export const billingPeriodSchema = z.enum(['monthly', 'yearly']);
export type BillingPeriod = z.infer<typeof billingPeriodSchema>;

/** Langkah 1: identitas klien + kontak owner. */
export const tenantClientDetailsSchema = z.object({
  companyName: companyNameSchema,
  ownerName: ownerNameSchema,
  ownerEmail: emailSchema,
  ownerPhone: phoneSchema,
  address: addressSchema,
});
export type TenantClientDetails = z.infer<typeof tenantClientDetailsSchema>;

/** Langkah 2: plan dan durasi. */
export const tenantPlanSchema = z.object({
  planTier: planTierSchema,
  billingPeriod: billingPeriodSchema,
});
export type TenantPlanInput = z.infer<typeof tenantPlanSchema>;

/** Langkah 3: kirim undangan atau tidak (tetap boleh di-resend dari detail). */
export const tenantInviteSchema = z.object({
  sendInvite: z.boolean().default(true),
});
export type TenantInviteInput = z.infer<typeof tenantInviteSchema>;

/** Gabungan seluruh wizard; server action memakai ini, client boleh per langkah. */
export const createTenantInputSchema = tenantClientDetailsSchema
  .merge(tenantPlanSchema)
  .merge(tenantInviteSchema)
  .extend({
    /** Catatan internal CEO; opsional dan ikut tercatat di audit log. */
    notes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .or(z.literal('').transform(() => undefined)),
  });
export type CreateTenantInput = z.infer<typeof createTenantInputSchema>;

/**
 * Aksi mutasi tenant pada halaman detail.
 *
 * `reset` mengirim ulang tautan undangan, `downgrade` menurunkan plan tanpa
 * mengubah status tenant. Alasan WAJIB untuk semua aksi destruktif.
 */
export const TENANT_ACTIONS = ['suspend', 'ban', 'restore', 'reset', 'downgrade'] as const;
export const tenantActionSchema = z.enum(TENANT_ACTIONS);
export type TenantAction = z.infer<typeof tenantActionSchema>;

const tenantIdSchema = z.string().uuid();
const reasonSchema = z.string().trim().min(4, 'Tulis alasan minimal 4 karakter.').max(500);

/**
 * Discriminated union: tiap aksi hanya menerima field yang benar-benar
 * dipakainya. Sebelumnya satu objek dengan `planTier` opsional membuat aturan
 * "wajib untuk downgrade" hanya hidup di prosa, sehingga aksi lain bisa lolos
 * dengan `planTier` yang tidak relevan.
 */
export const tenantActionInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('suspend'), tenantId: tenantIdSchema, reason: reasonSchema }),
  z.object({ action: z.literal('ban'), tenantId: tenantIdSchema, reason: reasonSchema }),
  z.object({ action: z.literal('restore'), tenantId: tenantIdSchema, reason: reasonSchema }),
  z.object({ action: z.literal('reset'), tenantId: tenantIdSchema, reason: reasonSchema }),
  z.object({
    action: z.literal('downgrade'),
    tenantId: tenantIdSchema,
    reason: reasonSchema,
    planTier: planTierSchema,
  }),
]);
export type TenantActionInput = z.infer<typeof tenantActionInputSchema>;

/** Status tenant yang boleh dipakai di UI (di luar `DELETED` yang belum ada alurnya). */
export const SELECTABLE_TENANT_STATUSES = tenantStatusSchema.exclude(['DELETED']);

/**
 * Matriks transisi status tenant, satu-satunya sumber kebenaran.
 *
 * Dipakai client (menyembunyikan aksi tidak valid) DAN server action (menolak
 * transisi ilegal). Sebelumnya aturan ini hidup di dua tempat yang berbeda dan
 * bisa menyimpang; sekarang keduanya membaca `statusTransitionError()`.
 *
 * `reset` bukan transisi status (ia hanya mengirim ulang undangan), jadi tidak
 * ada di peta ini.
 */
type TenantStatus = z.infer<typeof tenantStatusSchema>;
type StatusAction = Extract<TenantAction, 'suspend' | 'ban' | 'restore'>;

const STATUS_ACTION_TARGET: Record<StatusAction, TenantStatus> = {
  suspend: 'SUSPENDED',
  ban: 'BANNED',
  restore: 'ACTIVE',
};

/** Status yang boleh memulai tiap aksi. `ACTIVE` untuk restore tidak masuk akal. */
const STATUS_ACTION_SOURCES: Record<StatusAction, readonly TenantStatus[]> = {
  suspend: ['ACTIVE'],
  ban: ['ACTIVE', 'SUSPENDED'],
  restore: ['SUSPENDED', 'BANNED'],
};

/**
 * Memeriksa transisi status. Mengembalikan pesan penolakan, atau `null` bila sah.
 *
 * @param status Status tenant saat ini (dari DB).
 * @param action Aksi status yang diminta.
 */
export function statusTransitionError(status: string, action: StatusAction): string | null {
  const sources = STATUS_ACTION_SOURCES[action];
  if (!(sources as readonly string[]).includes(status)) {
    const target = STATUS_ACTION_TARGET[action];
    return `Tenant berstatus ${status}; aksi ini tidak berlaku (target ${target}).`;
  }
  return null;
}

/** Status hasil sebuah aksi status. */
export function statusAfterAction(action: StatusAction): TenantStatus {
  return STATUS_ACTION_TARGET[action];
}

/**
 * Hasil server action.
 *
 * Diskriminan `ok` dipakai client untuk memutuskan redirect vs menampilkan
 * error. `inviteFailed` sengaja terpisah dari kegagalan: provisioning DB bisa
 * sukses sementara email gagal, dan CEO harus tahu bedanya untuk bisa resend.
 */
export type TenantActionResult =
  | {
      readonly ok: true;
      readonly tenantId: string;
      readonly inviteFailed?: boolean;
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly code: TenantActionErrorCode;
      readonly message: string;
      readonly fieldErrors?: Readonly<Record<string, string>>;
    };

export const TENANT_ACTION_ERROR_CODES = [
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'CONFLICT',
  'INVITE_FAILED',
  'SERVER_ERROR',
] as const;
export type TenantActionErrorCode = (typeof TENANT_ACTION_ERROR_CODES)[number];

/**
 * Ringkasan plan untuk wizard.
 *
 * Bentuk ini adalah bentuk data NYATA dari tabel `plans`, bukan data contoh,
 * sehingga harga yang tampil di review sama dengan yang akan ditagih.
 */
export interface TenantPlanOption {
  readonly tier: z.infer<typeof planTierSchema>;
  readonly name: string;
  readonly priceMonthly: number;
  readonly priceYearly: number | null;
  readonly deviceIncluded: number;
  readonly staffLimit: number;
  readonly storageMb: number;
  readonly retentionDays: number;
}
