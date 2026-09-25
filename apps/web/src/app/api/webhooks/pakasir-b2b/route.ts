/**
 * Webhook Pakasir B2B (PRD Task 1.6, DRAFT).
 *
 * Alur yang mengikat (PRD Bab 6.V, ADR-002):
 * 1. himpun raw body persis seperti diterima,
 * 2. verifikasi signature HMAC-SHA256 SEBELUM parse,
 * 3. idempotensi lewat unique `(provider, provider_event_id)` di `webhook_events`,
 * 4. update status langganan hanya dari payload terverifikasi,
 * 5. balas 2xx cepat; kegagalan dicatat ke `webhook_failures`.
 *
 * Endpoint ini publik tapi tidak pernah mempercayai body sebelum signature
 * valid. Signature, secret, dan payload mentah TIDAK pernah dicatat ke log,
 * audit, atau respons.
 */
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { getDatabase, b2bSubscriptions, webhookEvents, webhookFailures } from '@snapbox/db';

import { verifyPakasirSignature } from '@/lib/ceo-dashboard/pakasir-b2b';
import {
  isPakasirPaidStatus,
  pakasirWebhookPayloadSchema,
  type PakasirWebhookPayload,
} from '@/lib/ceo-dashboard/subscription-contract';
import { findSubscriptionByPakasirRef } from '@/lib/ceo-dashboard/subscription-server';
import { writeAuditLog } from '@/lib/ceo-dashboard/tenant-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER = 'pakasir-b2b';
/** Batas ukuran body webhook; payload normal jauh di bawah ini. */
const MAX_BODY_BYTES = 64 * 1024;

const NO_STORE = { 'cache-control': 'no-store' } as const;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Catat kegagalan ke dead-letter TANPA membocorkan isi sensitif ke respons. */
async function recordFailure(payload: unknown, errorMessage: string): Promise<void> {
  try {
    await getDatabase()
      .insert(webhookFailures)
      .values({
        provider: PROVIDER,
        payload: (payload ?? {}) as Record<string, unknown>,
        errorMessage: errorMessage.slice(0, 500),
      });
  } catch {
    // Dead-letter gagal tidak boleh menjatuhkan handler; signature sudah valid.
  }
}

/**
 * Apakah error Postgres adalah pelanggaran unique constraint.
 *
 * Drizzle membungkus error driver, jadi kode dicek pada error itu sendiri dan
 * pada `cause`/`cause.cause` berantai. Hanya kode `23505` yang berarti duplikat;
 * selain itu dianggap kegagalan nyata supaya provider tetap mencoba ulang.
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === 'object' && current !== null) {
      if ((current as { code?: unknown }).code === '23505') return true;
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  return false;
}

/** Eksekusi update setelah event idempotent tercatat. */
async function applyEvent(
  eventId: string,
  payload: PakasirWebhookPayload,
  rawPayload: unknown,
): Promise<Response> {
  const subscription = await findSubscriptionByPakasirRef(payload.invoiceId, payload.transactionId);
  if (!subscription) {
    await recordFailure(rawPayload, 'Invoice tidak ditemukan di DB.');
    return json({ ok: false, error: 'invoice_not_found' }, 404);
  }

  if (isPakasirPaidStatus(payload.status)) {
    // Nominal provider TIDAK dipercaya untuk memperpanjang hak akses: bandingkan
    // dengan nilai invoice di DB. Pembayaran kurang dari nilai invoice ditolak,
    // bukan diterima sebagian, supaya tidak ada perpanjangan entitlement murah.
    if (Number(payload.amount) < Number(subscription.amount)) {
      await recordFailure(rawPayload, 'Nominal pembayaran kurang dari nilai invoice.');
      return json({ ok: false, error: 'amount_mismatch' }, 409);
    }

    // ACTIVE hanya dari webhook terverifikasi. Timestamp provider dipakai bila
    // ada; selain itu pakai waktu terima. `amount` historis tidak ditulis ulang.
    //
    // `validUntil` dari provider hanya informatif: tanggal berakhir dihitung
    // server dari periode langganan sendiri (`validUntil` DB), karena tanggal
    // yang dikendalikan provider bisa memperpanjang entitlement tanpa batas.
    const paidAt = payload.paidAt ?? new Date();
    const validUntil = subscription.validUntil ?? payload.validUntil ?? paidAt;

    await getDatabase()
      .update(b2bSubscriptions)
      .set({
        status: 'ACTIVE',
        paidAt: subscription.paidAt ?? paidAt,
        validFrom: subscription.validFrom ?? paidAt,
        validUntil,
        pakasirTransactionId: payload.transactionId ?? subscription.pakasirTransactionId,
        updatedAt: new Date(),
      })
      .where(eq(b2bSubscriptions.id, subscription.id));

    await writeAuditLog({
      actorUserId: subscription.tenantId,
      actorEmail: 'pakasir-webhook',
      tenantId: subscription.tenantId,
      action: 'subscription.webhook_paid',
      resourceType: 'b2b_subscription',
      resourceId: subscription.id,
      metadata: { eventId, status: payload.status },
    });
  } else if (payload.status === 'EXPIRED') {
    await getDatabase()
      .update(b2bSubscriptions)
      .set({ status: 'EXPIRED', updatedAt: new Date() })
      .where(eq(b2bSubscriptions.id, subscription.id));
  } else if (payload.status === 'CANCELLED') {
    await getDatabase()
      .update(b2bSubscriptions)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(eq(b2bSubscriptions.id, subscription.id));
  } else {
    // FAILED tidak mengubah status subscription; CEO dapat retry invoice.
    await recordFailure(rawPayload, `Status provider ${payload.status} tidak mengubah langganan.`);
  }

  try {
    await getDatabase()
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.providerEventId, eventId));
  } catch {
    // Marker proses bersifat opsional untuk replika; abaikan.
  }

  return json({ ok: true }, 200);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'payload_too_large' }, 413);
  }

  const signature = request.headers.get('x-pakasir-signature');
  if (!verifyPakasirSignature(rawBody, signature)) {
    // Signature invalid TIDAK disimpan sebagai event valid (bisa jadi probe).
    return json({ ok: false, error: 'invalid_signature' }, 401);
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    await recordFailure(null, 'Payload webhook bukan JSON.');
    return json({ ok: false, error: 'malformed_payload' }, 400);
  }

  const parsed = pakasirWebhookPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    await recordFailure(rawPayload, 'Field payload webhook tidak lengkap/tidak valid.');
    return json({ ok: false, error: 'invalid_payload' }, 400);
  }

  const payload = parsed.data;

  // Idempotensi: unique `(provider, provider_event_id)` menangkap duplikat.
  try {
    await getDatabase().insert(webhookEvents).values({
      provider: PROVIDER,
      providerEventId: payload.eventId,
      eventType: payload.status,
      // Simpan hanya payload tervalidasi (field asing sudah dibuang Zod).
      payload,
      signatureValid: true,
    });
  } catch (error) {
    // Hanya pelanggaran unique yang berarti duplikat. Kegagalan lain (koneksi,
    // transaksi batal) TIDAK boleh dibalas 200, karena provider akan berhenti
    // mencoba dan event hilang tanpa jejak di dead-letter.
    if (isUniqueViolation(error)) {
      // Duplikat = sudah pernah diproses. 200 tanpa update (PRD Bab 6.V).
      return json({ ok: true, duplicate: true }, 200);
    }

    await recordFailure(rawPayload, 'Gagal menyimpan marker idempotensi webhook.');
    return json({ ok: false, error: 'processing_failed' }, 500);
  }

  try {
    return await applyEvent(payload.eventId, payload, payload);
  } catch {
    // Marker idempotensi HARUS dibuang bila pemrosesan gagal. Tanpa ini, event
    // yang tersimpan dengan `processed_at = null` akan ditolak sebagai duplikat
    // pada retry provider berikutnya, sehingga update langganan hilang permanen
    // dan pembayaran sah tidak pernah menjadi ACTIVE.
    await getDatabase()
      .delete(webhookEvents)
      .where(
        and(
          eq(webhookEvents.provider, PROVIDER),
          eq(webhookEvents.providerEventId, payload.eventId),
        ),
      )
      .catch(() => undefined);
    await recordFailure(payload, 'Pemrosesan webhook gagal.');
    return json({ ok: false, error: 'processing_failed' }, 500);
  }
}

export async function GET() {
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}
