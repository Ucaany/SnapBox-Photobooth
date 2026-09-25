/**
 * Utilitas server invoice langganan B2B (PRD Task 1.6).
 *
 * Semua akses DB untuk modul invoice ada di sini agar Server Action dan route
 * webhook tetap tipis. Modul ini HANYA server: ia menarik `@snapbox/db` dan
 * memakai `requireCeo`/`writeAuditLog` dari `tenant-server`.
 *
 * Model data: satu row `b2b_subscriptions` adalah satu invoice. `tenants` dan
 * `plans` di-join untuk nama yang ditampilkan, sehingga tidak ada denormalisasi
 * yang bisa basi.
 */
import { desc, eq } from 'drizzle-orm';

import { getDatabase, b2bSubscriptions, plans, tenants } from '@snapbox/db';

import { invoiceDisplayStatus, isInvoiceRetryable, type InvoiceRow } from './subscription-contract';
import { TenantServerError } from './tenant-server';

/** Format Rupiah ringkas untuk tabel; nilai mentah tetap dikirim terpisah. */
function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Periode tampilan dari rentang validitas; fallback ke bulan dibuat. */
function periodLabel(validFrom: Date | null, validUntil: Date | null, createdAt: Date): string {
  const anchor = validFrom ?? createdAt;
  const end = validUntil;
  const start = new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(
    anchor,
  );
  if (!end) return start;
  const finish = new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(end);
  return `${start} - ${finish}`;
}

type SubscriptionRow = typeof b2bSubscriptions.$inferSelect;

function toInvoiceRow(
  subscription: SubscriptionRow,
  tenantName: string,
  planTier: string,
  planName: string,
): InvoiceRow {
  const amount = Number(subscription.amount);
  const statusInput = {
    status: subscription.status,
    pakasirInvoiceId: subscription.pakasirInvoiceId,
    paidAt: subscription.paidAt,
  };

  return {
    id: subscription.id,
    tenantId: subscription.tenantId,
    tenantName,
    planTier,
    planName,
    periodLabel: periodLabel(
      subscription.validFrom,
      subscription.validUntil,
      subscription.createdAt,
    ),
    amount: Number.isFinite(amount) ? amount : 0,
    amountLabel: formatRupiah(Number.isFinite(amount) ? amount : 0),
    status: invoiceDisplayStatus(statusInput),
    rawStatus: subscription.status,
    issuedAt: subscription.createdAt.toISOString(),
    paidAt: subscription.paidAt ? subscription.paidAt.toISOString() : null,
    invoiceId: subscription.pakasirInvoiceId,
    paymentUrl: subscription.pakasirPaymentUrl,
    retryable: isInvoiceRetryable(statusInput),
    isExample: false,
  };
}

/**
 * Daftar invoice lintas tenant, terbaru lebih dulu.
 *
 * Dibaca dengan join supaya nama tenant/plan selalu sinkron dengan DB. Hasil
 * kosong berarti "belum ada langganan", bukan error: pemanggil boleh memutuskan
 * memakai fallback data contoh.
 */
export async function listSubscriptionInvoices(limit = 50): Promise<readonly InvoiceRow[]> {
  const rows = await getDatabase()
    .select({
      subscription: b2bSubscriptions,
      tenantName: tenants.companyName,
      planTier: plans.tier,
      planName: plans.name,
    })
    .from(b2bSubscriptions)
    .innerJoin(tenants, eq(b2bSubscriptions.tenantId, tenants.id))
    .innerJoin(plans, eq(b2bSubscriptions.planId, plans.id))
    .orderBy(desc(b2bSubscriptions.createdAt))
    .limit(limit);

  return rows.map((row) =>
    toInvoiceRow(row.subscription, row.tenantName, row.planTier, row.planName),
  );
}

/** Row subscription mentah + nama, atau `NOT_FOUND` agar keberadaan tidak bocor. */
export interface SubscriptionContext {
  readonly subscription: SubscriptionRow;
  readonly tenantName: string;
  readonly planName: string;
}

/**
 * Mengambil satu subscription untuk create/retry.
 *
 * Validasi UUID tidak diulang di action: id non-UUID atau tidak ada sama-sama
 * menjadi `NOT_FOUND`.
 *
 * @throws {TenantServerError} `NOT_FOUND` bila row tidak ada.
 */
export async function getSubscriptionForInvoiceOr404(
  subscriptionId: string,
): Promise<SubscriptionContext> {
  const [row] = await getDatabase()
    .select({
      subscription: b2bSubscriptions,
      tenantName: tenants.companyName,
      planName: plans.name,
    })
    .from(b2bSubscriptions)
    .innerJoin(tenants, eq(b2bSubscriptions.tenantId, tenants.id))
    .innerJoin(plans, eq(b2bSubscriptions.planId, plans.id))
    .where(eq(b2bSubscriptions.id, subscriptionId))
    .limit(1);

  if (!row) {
    throw new TenantServerError('NOT_FOUND', 'Invoice tidak ditemukan.');
  }

  return row;
}

/** Mencari subscription dari id invoice/transaksi Pakasir (dipakai webhook). */
export async function findSubscriptionByPakasirRef(
  invoiceId: string,
  transactionId?: string,
): Promise<SubscriptionRow | null> {
  const db = getDatabase();

  const [byInvoice] = await db
    .select()
    .from(b2bSubscriptions)
    .where(eq(b2bSubscriptions.pakasirInvoiceId, invoiceId))
    .limit(1);
  if (byInvoice) return byInvoice;

  if (transactionId) {
    const [byTransaction] = await db
      .select()
      .from(b2bSubscriptions)
      .where(eq(b2bSubscriptions.pakasirTransactionId, transactionId))
      .limit(1);
    if (byTransaction) return byTransaction;
  }

  return null;
}
