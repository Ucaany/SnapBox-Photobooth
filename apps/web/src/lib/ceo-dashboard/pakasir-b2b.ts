/**
 * Adapter Pakasir B2B (DRAFT, PRD Task 1.6).
 *
 * Modul ini HANYA server: ia memegang API key dan webhook secret. Endpoint
 * vendor belum tersedia di repo/PRD, jadi alamatnya berasal dari env opsional
 * `PAKASIR_B2B_API_URL` dan adapter GAGAL TERTUTUP bila kosong. Tidak ada
 * endpoint hardcoded: menebak path vendor akan menghasilkan integrasi yang
 * tampak jalan padahal salah.
 *
 * Aturan yang mengikat:
 * - Hanya `fetch` bawaan; tidak menambah dependency vendor.
 * - Timeout eksplisit; respons divalidasi sebelum dipakai.
 * - API key, signature, raw body, dan pesan error vendor TIDAK pernah masuk
 *   log atau payload hasil action.
 * - Verifikasi signature webhook memakai `node:crypto` `timingSafeEqual`
 *   sehingga perbandingan tidak bocor lewat waktu.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import { pakasirWebhookEnvSchema, thirdPartyEnvSchema } from '@snapbox/shared/env';
import { z } from 'zod';

const PAKASIR_TIMEOUT_MS = 10_000;

/** Hasil create/retry invoice dari provider. */
export interface PakasirInvoice {
  readonly invoiceId: string;
  readonly paymentUrl: string | null;
}

export class PakasirError extends Error {
  readonly code: 'NOT_CONFIGURED' | 'PROVIDER_ERROR' | 'INVALID_RESPONSE';

  constructor(code: PakasirError['code'], message: string) {
    super(message);
    this.name = 'PakasirError';
    this.code = code;
  }
}

/**
 * Bentuk respons create invoice yang diterima.
 *
 * Beberapa gateway membungkus data di bawah `data`; keduanya diterima supaya
 * draft ini tidak pecah pada variasi umum. Field di luar bentuk ini diabaikan.
 */
const createInvoiceResponseSchema = z
  .object({
    invoice_id: z.string().trim().min(1).max(128).optional(),
    invoiceId: z.string().trim().min(1).max(128).optional(),
    payment_url: z.string().url().max(2048).optional(),
    paymentUrl: z.string().url().max(2048).optional(),
    data: z
      .object({
        invoice_id: z.string().trim().min(1).max(128).optional(),
        invoiceId: z.string().trim().min(1).max(128).optional(),
        payment_url: z.string().url().max(2048).optional(),
        paymentUrl: z.string().url().max(2048).optional(),
      })
      .optional(),
  })
  .transform((value) => {
    const source = value.data ?? value;
    return {
      invoiceId: source.invoice_id ?? source.invoiceId ?? null,
      paymentUrl: source.payment_url ?? source.paymentUrl ?? null,
    };
  });

interface PakasirConfig {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly webhookSecret: string;
  readonly webhookUrl: string;
}

/**
 * Membaca webhook secret Pakasir.
 *
 * PASCALOKAL: skema di sini HANYA berisi `PAKASIR_B2B_WEBHOOK_SECRET`. Bukan
 * `thirdPartyEnvSchema` (BE-026). Kalau skema yang lebar ikut divalidasi di
 * sini, satu variabel yang tidak ada hubungannya — `WHATSAPP_SALES_NUMBER`,
 * `RESEND_FROM_EMAIL`, apa pun — akan membuat verifikasi signature gagal
 * tertutup, dan setiap webhook pembayaran membalas 401 tanpa log apa pun.
 * Verifikasi signature tidak butuh kredensial lain, jadi ia tidak boleh menuntut
 * kredensial lain.
 *
 * Secret yang kosong adalah KESALAHAN KONFIGURASI, bukan signature yang salah,
 * jadi fungsi ini melempar `PakasirError('NOT_CONFIGURED')` dan bukan
 * mengembalikan `false`. Pemanggil wajib membedakan keduanya: `false` berarti
 * "provider mengirim signature yang salah" (401, tidak dicatat), `NOT_CONFIGURED`
 * berarti "server ini salah konfigurasi" (500, dicatat, dan provider boleh
 * mencoba ulang setelah diperbaiki). Mengembalikan `false` untuk keduanya
 * persis yang membuat bug ini tidak terlihat.
 */
export function readPakasirWebhookSecret(): string {
  const parsed = pakasirWebhookEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new PakasirError(
      'NOT_CONFIGURED',
      'PAKASIR_B2B_WEBHOOK_SECRET belum diset; verifikasi signature tidak dapat dijalankan.',
    );
  }
  return parsed.data.PAKASIR_B2B_WEBHOOK_SECRET;
}

/**
 * Membaca konfigurasi Pakasir lazily.
 *
 * `thirdPartyEnvSchema` sudah dipakai modul env bersama sehingga nama variabel
 * tidak ditulis ulang di sini. `PAKASIR_B2B_API_URL` adalah tambahan opsional
 * Task 1.6 dan sengaja dibaca langsung: ia belum ada di skema lama, dan
 * menambahkannya ke inventaris wajib akan memaksa setiap environment mengisi
 * nilai yang belum tentu dimiliki.
 *
 * CATATAN: fungsi ini TIDAK boleh dipakai di jalur verifikasi signature.
 * Pemanggil yang butuh `webhookSecret` saja harus memakai
 * `readPakasirWebhookSecret()`.
 */
export function readPakasirConfig(): PakasirConfig {
  const parsed = thirdPartyEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new PakasirError('NOT_CONFIGURED', 'Kredensial Pakasir B2B belum lengkap di server.');
  }

  const apiUrl = process.env.PAKASIR_B2B_API_URL?.trim();
  if (!apiUrl) {
    throw new PakasirError(
      'NOT_CONFIGURED',
      'PAKASIR_B2B_API_URL belum diset. Draft integrasi tidak mengirim permintaan ke vendor.',
    );
  }
  try {
    const url = new URL(apiUrl);
    if (url.protocol !== 'https:') {
      throw new Error('non-https');
    }
  } catch {
    throw new PakasirError('NOT_CONFIGURED', 'PAKASIR_B2B_API_URL harus URL HTTPS yang valid.');
  }

  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api/webhooks/pakasir-b2b`
    : '';

  return {
    apiUrl: apiUrl.replace(/\/$/, ''),
    apiKey: parsed.data.PAKASIR_B2B_API_KEY,
    webhookSecret: parsed.data.PAKASIR_B2B_WEBHOOK_SECRET,
    webhookUrl,
  };
}

/** Apakah integrasi Pakasir sudah bisa dipakai (URL + kredensial). */
export function isPakasirConfigured(): boolean {
  try {
    readPakasirConfig();
    return true;
  } catch {
    return false;
  }
}

export interface CreatePakasirInvoiceInput {
  /** Reference stabil milik SnapBox (id subscription), dipakai provider untuk dedupe. */
  readonly referenceId: string;
  readonly tenantName: string;
  readonly planName: string;
  /** Nominal canonical dari DB, sudah string desimal. */
  readonly amount: string;
  /** Existing provider invoice for retry; omit on first creation. */
  readonly invoiceId?: string;
  readonly currency?: 'IDR';
}

/**
 * Membuat invoice di Pakasir.
 *
 * Permintaan dikirim ke `<PAKASIR_B2B_API_URL>/invoices`; `referenceId` yang
 * stabil berfungsi sebagai idempotency key sehingga retry tidak menggandakan
 * invoice. Respons tanpa `invoice_id` dianggap gagal: row DB tidak boleh
 * menyimpan invoice yang tidak bisa dilacak.
 */
export async function createPakasirInvoice(
  input: CreatePakasirInvoiceInput,
): Promise<PakasirInvoice> {
  const config = readPakasirConfig();

  const body = {
    reference_id: input.referenceId,
    customer_name: input.tenantName,
    description: `Langganan ${input.planName}`,
    amount: Number(input.amount),
    currency: input.currency ?? 'IDR',
    ...(input.invoiceId ? { invoice_id: input.invoiceId } : {}),
    ...(config.webhookUrl ? { callback_url: config.webhookUrl } : {}),
  };

  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}/invoices`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PAKASIR_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch {
    // Pesan vendor/stack tidak diteruskan: bisa memuat host internal.
    throw new PakasirError('PROVIDER_ERROR', 'Gateway Pakasir tidak dapat dihubungi.');
  }

  if (!response.ok) {
    throw new PakasirError(
      'PROVIDER_ERROR',
      `Gateway Pakasir menolak permintaan (HTTP ${response.status}).`,
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new PakasirError('INVALID_RESPONSE', 'Respons Pakasir tidak berformat JSON.');
  }

  const parsed = createInvoiceResponseSchema.safeParse(json);
  if (!parsed.success || !parsed.data.invoiceId) {
    throw new PakasirError('INVALID_RESPONSE', 'Respons Pakasir tidak memuat id invoice.');
  }

  return { invoiceId: parsed.data.invoiceId, paymentUrl: parsed.data.paymentUrl };
}

/**
 * Membuat (atau mengambil ulang) invoice untuk tagih ulang.
 *
 * Retry memakai reference yang sama, jadi provider dapat mengembalikan invoice
 * yang sudah ada alih-alih membuat yang baru — perilaku yang diinginkan.
 */
export function retryPakasirInvoice(input: CreatePakasirInvoiceInput): Promise<PakasirInvoice> {
  if (!input.invoiceId) {
    throw new PakasirError('PROVIDER_ERROR', 'Invoice existing tidak tersedia untuk retry.');
  }
  return createPakasirInvoice(input);
}

/**
 * Verifikasi signature webhook `X-Pakasir-Signature` (HMAC-SHA256 hex).
 *
 * Membandingkan digest dalam waktu konstan. Panjang berbeda langsung ditolak
 * tanpa memanggil `timingSafeEqual` yang akan melempar pada buffer tak sama
 * panjang. Signature kosong/bukan hex gagal tertutup.
 *
 * `NOT_CONFIGURED` TIDAK lagi diteruskan sebagai `false` (BE-026). Secret yang
 * tidak terisi adalah kesalahan konfigurasi server, dan membalas 401 untuk
 * kesalahan konfigurasi membuatnya terlihat seperti penolakan signature — tidak
 * ada log, tidak ada provider yang diberi tahu, dan setiap pembayaran gagal
 * diam-diam. Yang dilempar ke pemanggil, yang wajib membalas 500 dan
 * mencatatnya.
 *
 * @param rawBody Body mentah persis seperti diterima; JANGAN pakai hasil parse.
 * @param signature Header signature dari provider.
 * @param secret Webhook secret; default dari env.
 */
export function verifyPakasirSignature(
  rawBody: string,
  signature: string | null,
  secret?: string,
): boolean {
  if (!rawBody || !signature) return false;

  let webhookSecret: string;
  try {
    webhookSecret = secret ?? readPakasirWebhookSecret();
  } catch (cause) {
    if (cause instanceof PakasirError) throw cause;
    throw new PakasirError('NOT_CONFIGURED', 'Kredensial webhook Pakasir tidak dapat dibaca.');
  }

  const expected = createHmac('sha256', webhookSecret).update(rawBody, 'utf8').digest('hex');
  const normalized = signature.trim().toLowerCase();

  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(normalized, 'hex'));
}
