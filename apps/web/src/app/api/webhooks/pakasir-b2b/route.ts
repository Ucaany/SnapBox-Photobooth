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
 *
 * Idempotensi dibuat RETRY-SAFE: marker event dibuang bila pemrosesan gagal
 * (termasuk invoice belum ada / nominal tidak cocok), supaya provider yang
 * mengirim ulang tidak ditolak sebagai duplikat dan pembayaran sah tidak hilang.
 */
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { getDatabase, b2bSubscriptions, webhookEvents, webhookFailures } from '@snapbox/db';

import { verifyPakasirSignature } from '@/lib/ceo-dashboard/pakasir-b2b';
import {
  isPakasirPaidStatus,
  pakasirWebhookPayloadSchema,
  webhookAmountMatches,
  type PakasirWebhookPayload,
} from '@/lib/ceo-dashboard/subscription-contract';
import {
  findSubscriptionByPakasirRef,
  SubscriptionRefConflictError,
} from '@/lib/ceo-dashboard/subscription-server';
import { writeAuditLog } from '@/lib/ceo-dashboard/tenant-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER = 'pakasir-b2b';
/** Batas ukuran body webhook; payload normal jauh di bawah ini. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Toleransi `validUntil` lampau (jam). Sedikit toleransi clock skew masih
 * diterima, tetapi tanggal yang benar-benar lewat ditolak agar tidak ada state
 * kontradiktif `ACTIVE` + sudah kedaluwarsa.
 */
const VALID_UNTIL_PAST_TOLERANCE_MS = 60 * 60 * 1000;
/** Batas atas perpanjangan; mencegah entitlement bertahun-tahun dari satu event. */
const MAX_VALIDITY_WINDOW_MS = 400 * 24 * 60 * 60 * 1000;

const NO_STORE = { 'cache-control': 'no-store' } as const;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Apakah error Postgres adalah pelanggaran unique constraint.
 *
 * Drizzle membungkus error driver, jadi kode dicek pada error itu sendiri dan
 * pada rantai `cause`. Hanya kode `23505` yang berarti duplikat; selain itu
 * dianggap kegagalan nyata supaya provider tetap mencoba ulang.
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
 * Menentukan `validUntil` yang dipakai setelah pembayaran lunas.
 *
 * Tanggal berakhir TIDAK pernah diambil dari provider sebagai sumber tunggal:
 * provider bisa mengirim tanggal lampau (state `ACTIVE` + expired) atau terlalu
 * jauh di masa depan. Nilai dipakai hanya bila wajar; selain itu pertahankan
 * nilai DB. Guard monotonic di pemanggil memastikan periode tidak pernah
 * memendek karena event lama/out-of-order.
 */
function resolveValidUntil(
  fromPayload: Date | undefined,
  current: Date | null,
  now: Date,
): Date | null {
  if (!fromPayload) return current;

  if (fromPayload.getTime() < now.getTime() - VALID_UNTIL_PAST_TOLERANCE_MS) return null;
  if (fromPayload.getTime() - now.getTime() > MAX_VALIDITY_WINDOW_MS) return null;

  return current && current > fromPayload ? current : fromPayload;
}

/**
 * Menjalankan efek satu event TERVERIFIKASI.
 *
 * @returns `null` bila event berhasil diterapkan (pemanggil membalas 2xx), atau
 *   Response non-2xx bila provider harus mencoba ulang. Pemanggil WAJIB membuang
 *   marker idempotensi saat hasilnya non-2xx.
 */
async function applyEvent(payload: PakasirWebhookPayload): Promise<Response | null> {
  let subscription;
  try {
    subscription = await findSubscriptionByPakasirRef(payload.invoiceId, payload.transactionId);
  } catch (error) {
    if (error instanceof SubscriptionRefConflictError) {
      await recordFailure(payload, error.message);
      return json({ ok: false, error: 'reference_conflict' }, 409);
    }
    throw error;
  }

  if (!subscription) {
    // Invoice mungkin belum terpersist (race deploy). Biarkan provider retry.
    await recordFailure(payload, 'Invoice tidak ditemukan di DB.');
    return json({ ok: false, error: 'invoice_not_found' }, 404);
  }

  const now = new Date();

  if (isPakasirPaidStatus(payload.status)) {
    // Nominal provider TIDAK dipercaya begitu saja: harus cocok dengan nilai
    // invoice di DB. Pembayaran kurang maupun lebih tidak boleh mengaktifkan.
    if (!webhookAmountMatches(payload.amount, String(subscription.amount))) {
      await recordFailure(payload, 'Nominal webhook tidak cocok dengan nominal invoice.');
      return json({ ok: false, error: 'amount_mismatch' }, 409);
    }

    const validUntil = resolveValidUntil(payload.validUntil, subscription.validUntil, now);
    if (!validUntil) {
      await recordFailure(payload, 'validUntil webhook tidak wajar (lampau atau di luar rentang).');
      return json({ ok: false, error: 'invalid_valid_until' }, 409);
    }

    // Idempotensi kedua di level row: transaksi yang sama tidak diterapkan dua kali.
    if (payload.transactionId && subscription.pakasirTransactionId === payload.transactionId) {
      return null;
    }

    // Guard monotonic: event lama (retry/out-of-order) tidak boleh memundurkan
    // paidAt/validUntil yang sudah lebih baru.
    const paidAt = payload.paidAt ?? now;
    const nextPaidAt =
      subscription.paidAt && subscription.paidAt > paidAt ? subscription.paidAt : paidAt;
    const nextValidUntil =
      subscription.validUntil && subscription.validUntil > validUntil
        ? subscription.validUntil
        : validUntil;

    await getDatabase()
      .update(b2bSubscriptions)
      .set({
        status: 'ACTIVE',
        paidAt: nextPaidAt,
        validFrom: subscription.validFrom ?? paidAt,
        validUntil: nextValidUntil,
        pakasirTransactionId: payload.transactionId ?? subscription.pakasirTransactionId,
        updatedAt: now,
      })
      .where(eq(b2bSubscriptions.id, subscription.id));

    await writeAuditLog({
      // Webhook tidak punya user actor: actorUserId TIDAK boleh diisi tenantId,
      // dan role tidak boleh diklaim sebagai CEO.
      actorUserId: null,
      actorEmail: 'pakasir-webhook',
      actorRole: null,
      tenantId: subscription.tenantId,
      action: 'subscription.webhook_paid',
      resourceType: 'b2b_subscription',
      resourceId: subscription.id,
      metadata: { eventId: payload.eventId, status: payload.status, amount: payload.amount },
    });
  } else if (payload.status === 'EXPIRED') {
    await getDatabase()
      .update(b2bSubscriptions)
      .set({ status: 'EXPIRED', updatedAt: now })
      .where(eq(b2bSubscriptions.id, subscription.id));
  } else if (payload.status === 'CANCELLED') {
    await getDatabase()
      .update(b2bSubscriptions)
      .set({ status: 'CANCELLED', updatedAt: now })
      .where(eq(b2bSubscriptions.id, subscription.id));
  } else {
    // FAILED tidak mengubah status subscription; CEO dapat retry invoice.
    await recordFailure(payload, `Status provider ${payload.status} tidak mengubah langganan.`);
  }

  return null;
}

/** Menandai event selesai diproses; filter WAJIB menyertakan provider. */
async function markProcessed(eventId: string): Promise<void> {
  await getDatabase()
    .update(webhookEvents)
    .set({ processedAt: new Date() })
    .where(and(eq(webhookEvents.provider, PROVIDER), eq(webhookEvents.providerEventId, eventId)));
}

/** Membuang marker idempotensi agar retry provider tidak ditolak duplikat. */
async function releaseMarker(eventId: string): Promise<void> {
  await getDatabase()
    .delete(webhookEvents)
    .where(and(eq(webhookEvents.provider, PROVIDER), eq(webhookEvents.providerEventId, eventId)))
    .catch(() => undefined);
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
      // Event sudah pernah diterima. Balas 200 HANYA bila pemrosesan sebelumnya
      // benar-benar selesai; marker yang belum selesai dilepas agar retry ini
      // diproses alih-alih dianggap duplikat final.
      const [existing] = await getDatabase()
        .select({ processedAt: webhookEvents.processedAt })
        .from(webhookEvents)
        .where(
          and(
            eq(webhookEvents.provider, PROVIDER),
            eq(webhookEvents.providerEventId, payload.eventId),
          ),
        )
        .limit(1);

      if (existing?.processedAt) {
        return json({ ok: true, duplicate: true }, 200);
      }

      await releaseMarker(payload.eventId);
      try {
        await getDatabase().insert(webhookEvents).values({
          provider: PROVIDER,
          providerEventId: payload.eventId,
          eventType: payload.status,
          payload,
          signatureValid: true,
        });
      } catch {
        await recordFailure(payload, 'Gagal mengklaim ulang marker idempotensi webhook.');
        return json({ ok: false, error: 'processing_failed' }, 500);
      }
    } else {
      await recordFailure(rawPayload, 'Gagal menyimpan marker idempotensi webhook.');
      return json({ ok: false, error: 'processing_failed' }, 500);
    }
  }

  try {
    const result = await applyEvent(payload);
    if (result) {
      // Pemrosesan tidak diterapkan: lepas marker supaya provider bisa retry.
      await releaseMarker(payload.eventId);
      return result;
    }
    await markProcessed(payload.eventId);
    return json({ ok: true }, 200);
  } catch {
    // Marker idempotensi HARUS dibuang bila pemrosesan gagal. Tanpa ini, event
    // yang tersimpan dengan `processed_at = null` akan ditolak sebagai duplikat
    // pada retry provider berikutnya, sehingga update langganan hilang permanen
    // dan pembayaran sah tidak pernah menjadi ACTIVE.
    await releaseMarker(payload.eventId);
    await recordFailure(payload, 'Pemrosesan webhook gagal.');
    return json({ ok: false, error: 'processing_failed' }, 500);
  }
}

export async function GET() {
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}
