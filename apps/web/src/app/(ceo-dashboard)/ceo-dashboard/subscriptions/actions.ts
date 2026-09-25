/**
 * Server action invoice langganan B2B (PRD Task 1.6, DRAFT).
 *
 * Urutan tetap, sama seperti modul tenant (Task 1.4) dan plan (Task 1.5):
 * 1. otorisasi CEO dari sesi + DB (`requireCeo`),
 * 2. validasi input dengan skema kontrak (input browser tidak dipercaya),
 * 3. baca row canonical + tenant/plan dari DB,
 * 4. panggil adapter Pakasir,
 * 5. tulis hasil provider ke row SETELAH sukses,
 * 6. audit + `revalidatePath`.
 *
 * Yang TIDAK dilakukan action ini: mengubah `status`/`paidAt`. Langganan hanya
 * menjadi ACTIVE lewat webhook Pakasir terverifikasi (ADR-002). Action hanya
 * menempelkan id/URL invoice agar owner bisa membayar.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

import { getDatabase, b2bSubscriptions } from '@snapbox/db';

import {
  createPakasirInvoice,
  isPakasirConfigured,
  PakasirError,
  retryPakasirInvoice,
} from '@/lib/ceo-dashboard/pakasir-b2b';
import {
  invoiceActionInputSchema,
  isInvoiceRetryable,
  SUBSCRIPTION_ACTION_ERROR_CODES,
  type SubscriptionActionResult,
} from '@/lib/ceo-dashboard/subscription-contract';
import {
  getSubscriptionForInvoiceOr404,
  type SubscriptionContext,
} from '@/lib/ceo-dashboard/subscription-server';
import { requireCeo, TenantServerError, writeAuditLog } from '@/lib/ceo-dashboard/tenant-server';

type ErrorCode = (typeof SUBSCRIPTION_ACTION_ERROR_CODES)[number];

function failure(
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
): SubscriptionActionResult {
  return { ok: false, code, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

/** Memetakan kegagalan adapter ke kode user-safe tanpa detail vendor. */
function providerFailure(error: unknown): SubscriptionActionResult {
  if (error instanceof PakasirError) {
    if (error.code === 'NOT_CONFIGURED') return failure('NOT_CONFIGURED', error.message);
    return failure('PROVIDER_ERROR', error.message);
  }
  return failure('SERVER_ERROR', 'Permintaan invoice tidak dapat diproses.');
}

/** Payload adapter dari row canonical; nominal selalu dari DB, bukan body. */
function toProviderInput(context: SubscriptionContext, includeExistingInvoice = false) {
  return {
    referenceId: context.subscription.id,
    tenantName: context.tenantName,
    planName: context.planName,
    amount: String(context.subscription.amount),
    ...(includeExistingInvoice && context.subscription.pakasirInvoiceId
      ? { invoiceId: context.subscription.pakasirInvoiceId }
      : {}),
  } as const;
}

/** Simpan id/URL invoice. Sengaja tidak menyentuh `status`, `paidAt`, `amount`. */
async function persistInvoice(
  subscriptionId: string,
  invoiceId: string,
  paymentUrl: string | null,
): Promise<void> {
  await getDatabase()
    .update(b2bSubscriptions)
    .set({ pakasirInvoiceId: invoiceId, pakasirPaymentUrl: paymentUrl, updatedAt: new Date() })
    .where(eq(b2bSubscriptions.id, subscriptionId));
}

/**
 * Membuat invoice Pakasir untuk satu langganan (draft).
 *
 * Bila row sudah punya `pakasirInvoiceId`, action menolak: invoice existing
 * harus dipakai lewat `retryInvoice` agar reference/idempotency tidak berubah.
 */
export async function createInvoice(input: unknown): Promise<SubscriptionActionResult> {
  const parsed = invoiceActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure('INVALID_INPUT', 'Permintaan invoice tidak valid.');
  }

  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  let context: SubscriptionContext;
  try {
    context = await getSubscriptionForInvoiceOr404(parsed.data.subscriptionId);
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  if (context.subscription.pakasirInvoiceId) {
    return failure(
      'CONFLICT',
      'Invoice sudah diterbitkan. Gunakan tagih ulang untuk meminta tautan baru.',
    );
  }

  if (!isPakasirConfigured()) {
    return failure(
      'NOT_CONFIGURED',
      'Integrasi Pakasir belum dikonfigurasi. Set PAKASIR_B2B_API_URL dan kredensial di server.',
    );
  }

  let invoice;
  try {
    invoice = await createPakasirInvoice(toProviderInput(context));
  } catch (error) {
    return providerFailure(error);
  }

  try {
    await persistInvoice(context.subscription.id, invoice.invoiceId, invoice.paymentUrl);
  } catch {
    return failure('SERVER_ERROR', 'Invoice dibuat tetapi gagal disimpan. Coba lagi.');
  }

  await writeAuditLog({
    actorUserId: session.userId,
    actorEmail: session.email,
    tenantId: context.subscription.tenantId,
    action: 'subscription.invoice_create',
    resourceType: 'b2b_subscription',
    resourceId: context.subscription.id,
    metadata: { invoiceId: invoice.invoiceId, hasPaymentUrl: Boolean(invoice.paymentUrl) },
  });

  revalidatePath('/ceo-dashboard/subscriptions');

  return {
    ok: true,
    subscriptionId: context.subscription.id,
    invoiceId: invoice.invoiceId,
    paymentUrl: invoice.paymentUrl,
    message: 'Invoice Pakasir dibuat.',
  };
}

/**
 * Menagih ulang invoice yang gagal/belum lunas.
 *
 * Memakai `referenceId` yang sama sehingga provider dapat mengembalikan invoice
 * yang sudah ada; tidak ada invoice ganda. Hanya row retryable yang diproses.
 */
export async function retryInvoice(input: unknown): Promise<SubscriptionActionResult> {
  const parsed = invoiceActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure('INVALID_INPUT', 'Permintaan tagih ulang tidak valid.');
  }

  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  let context: SubscriptionContext;
  try {
    context = await getSubscriptionForInvoiceOr404(parsed.data.subscriptionId);
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  if (!isInvoiceRetryable(context.subscription)) {
    return failure(
      'CONFLICT',
      'Invoice ini sudah lunas atau dibatalkan sehingga tidak perlu ditagih ulang.',
    );
  }

  if (!isPakasirConfigured()) {
    return failure(
      'NOT_CONFIGURED',
      'Integrasi Pakasir belum dikonfigurasi. Set PAKASIR_B2B_API_URL dan kredensial di server.',
    );
  }

  let invoice;
  try {
    invoice = await retryPakasirInvoice(toProviderInput(context, true));
  } catch (error) {
    return providerFailure(error);
  }

  try {
    await persistInvoice(context.subscription.id, invoice.invoiceId, invoice.paymentUrl);
  } catch {
    return failure('SERVER_ERROR', 'Invoice dibuat tetapi gagal disimpan. Coba lagi.');
  }

  await writeAuditLog({
    actorUserId: session.userId,
    actorEmail: session.email,
    tenantId: context.subscription.tenantId,
    action: 'subscription.invoice_retry',
    resourceType: 'b2b_subscription',
    resourceId: context.subscription.id,
    metadata: { invoiceId: invoice.invoiceId, hasPaymentUrl: Boolean(invoice.paymentUrl) },
  });

  revalidatePath('/ceo-dashboard/subscriptions');

  return {
    ok: true,
    subscriptionId: context.subscription.id,
    invoiceId: invoice.invoiceId,
    paymentUrl: invoice.paymentUrl,
    message: 'Permintaan tagih ulang dikirim ke Pakasir.',
  };
}
