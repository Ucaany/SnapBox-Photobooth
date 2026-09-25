/**
 * Kontrak invoice & langganan B2B (PRD Task 1.6).
 *
 * Modul ini adalah trust boundary antara tabel/aksi invoice (client) dan
 * Server Action serta webhook (server). Skema dipakai DUA KALI: di browser
 * untuk feedback cepat, dan di server karena input eksternal tidak pernah
 * dipercaya (PRD Bab 5.5, ADR-004).
 *
 * Task 1.6 memakai row `b2b_subscriptions` yang sudah ada sebagai invoice:
 * tidak ada tabel `b2b_invoices` dan tidak ada enum `FAILED` baru. Status
 * "Gagal" yang tampil di UI DITURUNKAN dari kondisi row (lihat
 * `invoiceDisplayStatus`), bukan disimpan sebagai state kelima.
 *
 * Modul ini bebas `next/*`, DB, dan SDK apa pun supaya aman diimpor dari
 * komponen client.
 */
import { z } from 'zod';

import { subscriptionStatusSchema } from '@snapbox/shared/domain';

/** Batas aman di bawah presisi kolom `numeric(12,2)`. */
const MAX_AMOUNT = 9_999_999_999;

// ============ INPUT AKSI ============

/** Id subscription/invoice; satu-satunya bentuk yang diterima action. */
export const subscriptionIdSchema = z.string().uuid();

export const invoiceActionInputSchema = z.object({
  subscriptionId: subscriptionIdSchema,
});
export type InvoiceActionInput = z.infer<typeof invoiceActionInputSchema>;

// ============ KONTRAK WEBHOOK PAKASIR (DRAFT) ============

/**
 * Status provider yang dikenali draft ini.
 *
 * Nilai mengikuti kata yang lazim dipakai gateway pembayaran (PAID/SUCCESS/
 * SETTLED/EXPIRED/FAILED). Kontrak final harus disesuaikan begitu dokumentasi
 * resmi Pakasir B2B tersedia; sampai itu, status di luar daftar ini ditolak
 * fail-closed alih-alih ditebak.
 */
export const PAKASIR_EVENT_STATUSES = [
  'PAID',
  'SUCCESS',
  'SETTLED',
  'EXPIRED',
  'FAILED',
  'CANCELLED',
] as const;
export const pakasirEventStatusSchema = z.enum(PAKASIR_EVENT_STATUSES);
export type PakasirEventStatus = z.infer<typeof pakasirEventStatusSchema>;

/** Label ringkas untuk status provider draft; dipakai UI webhook bila perlu. */
export function isPakasirPaidStatus(status: PakasirEventStatus): boolean {
  return status === 'PAID' || status === 'SUCCESS' || status === 'SETTLED';
}

/** Timestamp ISO yang diterima; `null` bila provider tidak mengirimkannya. */
const isoDateSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Timestamp tidak valid.' })
  .transform((value) => new Date(value));

/**
 * Payload webhook draft.
 *
 * Field yang benar-benar dibutuhkan engine hanya id event/transaksi, id invoice,
 * status, nominal, dan waktu opsional. Field lain dari provider sengaja TIDAK
 * di-declare: Zod default membuang key asing sehingga payload besar tidak
 * disimpan utuh, apalagi signature/secret.
 *
 * `.strict()` dipakai hanya pada level ini agar payload dengan field asing TIDAK
 * ditolak (provider boleh menambah field tanpa mematahkan webhook) tetapi juga
 * tidak ikut tersimpan.
 */
export const pakasirWebhookPayloadSchema = z.object({
  /** Id unik event dari provider; dasar idempotensi. */
  eventId: z.string().trim().min(1).max(200),
  /** Id invoice Pakasir yang dipetakan ke `b2b_subscriptions.pakasir_invoice_id`. */
  invoiceId: z.string().trim().min(1).max(128),
  /** Id transaksi provider; dipakai sebagai kunci idempotensi kedua. */
  transactionId: z.string().trim().min(1).max(128).optional(),
  status: pakasirEventStatusSchema,
  amount: z
    .union([
      z
        .string()
        .trim()
        .regex(/^\d+(\.\d{1,2})?$/),
      z.number().finite().nonnegative(),
    ])
    .transform((value) => (typeof value === 'number' ? value.toFixed(2) : value))
    .refine((value) => Number(value) <= MAX_AMOUNT, { message: 'Nominal di luar rentang.' }),
  paidAt: isoDateSchema.optional(),
  validUntil: isoDateSchema.optional(),
});
export type PakasirWebhookPayload = z.infer<typeof pakasirWebhookPayloadSchema>;

// ============ HASIL AKSI ============

export const SUBSCRIPTION_ACTION_ERROR_CODES = [
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'CONFLICT',
  'NOT_CONFIGURED',
  'PROVIDER_ERROR',
  'SERVER_ERROR',
] as const;
export type SubscriptionActionErrorCode = (typeof SUBSCRIPTION_ACTION_ERROR_CODES)[number];

export type SubscriptionActionResult =
  | {
      readonly ok: true;
      readonly subscriptionId: string;
      readonly invoiceId: string;
      readonly paymentUrl: string | null;
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly code: SubscriptionActionErrorCode;
      readonly message: string;
      readonly fieldErrors?: Readonly<Record<string, string>>;
    };

// ============ STATUS PRESENTASI ============

export const INVOICE_DISPLAY_STATUSES = [
  'Lunas',
  'Menunggu',
  'Gagal',
  'Kedaluwarsa',
  'Dibatalkan',
] as const;
export type InvoiceDisplayStatus = (typeof INVOICE_DISPLAY_STATUSES)[number];

/** Bagian row subscription yang menentukan status presentasi. */
export interface InvoiceStatusInput {
  readonly status: z.infer<typeof subscriptionStatusSchema>;
  readonly pakasirInvoiceId: string | null;
  readonly paidAt: Date | null;
  /** Penanda kegagalan create/retry TERAKHIR dari hasil action, bukan state DB. */
  readonly lastAttemptFailed?: boolean;
}

/**
 * Menurunkan status invoice untuk tabel CEO.
 *
 * `ACTIVE` (atau `paidAt` terisi) selalu `Lunas`: pembayaran nyata hanya boleh
 * datang dari webhook terverifikasi. `PENDING` dengan invoice Pakasir berarti
 * `Menunggu`; `PENDING` tanpa invoice setelah upaya create gagal berarti
 * `Gagal`. Status terminal lain dipetakan apa adanya.
 */
export function invoiceDisplayStatus(row: InvoiceStatusInput): InvoiceDisplayStatus {
  if (row.status === 'ACTIVE' || row.status === 'EXPIRING' || row.paidAt) {
    return 'Lunas';
  }

  if (row.status === 'PENDING') {
    if (row.lastAttemptFailed && !row.pakasirInvoiceId) return 'Gagal';
    return row.pakasirInvoiceId ? 'Menunggu' : 'Gagal';
  }

  if (row.status === 'GRACE_PERIOD' || row.status === 'EXPIRED') return 'Kedaluwarsa';
  if (row.status === 'CANCELLED') return 'Dibatalkan';
  if (row.status === 'SUSPENDED') return 'Kedaluwarsa';

  return 'Menunggu';
}

/**
 * Apakah baris boleh ditagih ulang dari dashboard.
 *
 * Hanya invoice yang belum lunas dan belum dibatalkan yang bisa diretry.
 * Pending yang sudah punya URL milik provider tetap boleh diretry dengan
 * reference yang sama (idempotency key), jadi tidak ada double invoice.
 */
export function isInvoiceRetryable(row: InvoiceStatusInput): boolean {
  if (row.paidAt) return false;
  return row.status === 'PENDING' || row.status === 'GRACE_PERIOD' || row.status === 'EXPIRED';
}

/** Row invoice tervalidasi yang aman dikirim ke client (tanpa secret). */
export interface InvoiceRow {
  readonly id: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly planTier: string;
  readonly planName: string;
  readonly periodLabel: string;
  readonly amount: number;
  readonly amountLabel: string;
  readonly status: InvoiceDisplayStatus;
  readonly rawStatus: z.infer<typeof subscriptionStatusSchema>;
  readonly issuedAt: string;
  readonly paidAt: string | null;
  readonly invoiceId: string | null;
  readonly paymentUrl: string | null;
  readonly retryable: boolean;
  readonly isExample: boolean;
}
