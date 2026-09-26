/**
 * `POST /api/booth/pair-session` — menerbitkan sesi pairing (PRD Bab 6.B, 7.4).
 *
 * Dipanggil Owner terautentikasi dari Machine Manager saat membuat device baru
 * atau mengganti kode pairing. Server membuat baris `pairing_tokens` (hash saja,
 * TTL 10 menit, single-use, tenant + booth scoped) dan mengembalikan payload QR
 * sekali pakai. Kredensial perangkat penuh TIDAK PERNAH masuk QR.
 *
 * Consumer QR (`/api/booth/pair`) adalah pekerjaan Fase 3/Tauri; endpoint ini
 * sengaja tidak menebak kontraknya.
 */
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { booths, getDatabase } from '@snapbox/db';

import { checkAuthRateLimit, authRateLimitKey } from '@/lib/auth/rate-limit';
import {
  createPairingSessionInputSchema,
  qrPngDataUrl,
  type PairingSessionResult,
} from '@/lib/owner-dashboard/machine-contract';
import { machineQuota, requireOwnerTenant } from '@/lib/owner-dashboard/machine-server';
import { insertPairingSession } from '@/app/(owner-dashboard)/owner-dashboard/machines/pairing-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: PairingSessionResult, status: number) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  const limit = checkAuthRateLimit(authRateLimitKey(request, 'booth-pair-session'));
  if (!limit.allowed) {
    return json(
      {
        ok: false,
        code: 'LIMIT_REACHED',
        message: 'Terlalu banyak permintaan. Coba lagi beberapa saat lagi.',
      },
      429,
    );
  }

  const auth = await requireOwnerTenant();
  if (!auth)
    return json({ ok: false, code: 'UNAUTHORIZED', message: 'Sesi tidak berwenang.' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: 'INVALID_INPUT', message: 'Permintaan tidak valid.' }, 400);
  }

  const parsed = createPairingSessionInputSchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, code: 'INVALID_INPUT', message: 'Id mesin tidak valid.' }, 400);
  }

  const quota = await machineQuota(auth.tenantId);
  if (quota.limit !== null && quota.limit !== -1 && quota.used >= quota.limit) {
    return json(
      { ok: false, code: 'LIMIT_REACHED', message: 'Batas perangkat plan telah tercapai.' },
      409,
    );
  }

  try {
    const session = await getDatabase().transaction(async (tx) => {
      const [booth] = await tx
        .select({ id: booths.id, status: booths.status, fingerprint: booths.deviceFingerprint })
        .from(booths)
        .where(and(eq(booths.id, parsed.data.boothId), eq(booths.tenantId, auth.tenantId)))
        .limit(1);
      if (!booth) return { status: 'not_found' as const };
      if (booth.fingerprint) return { status: 'conflict' as const };

      const issued = await insertPairingSession(tx, {
        tenantId: auth.tenantId,
        boothId: booth.id,
        userId: auth.session.userId,
      });
      return { status: 'ok' as const, issued, boothId: booth.id };
    });

    if (session.status === 'not_found')
      return json({ ok: false, code: 'NOT_FOUND', message: 'Mesin tidak ditemukan.' }, 404);
    if (session.status === 'conflict')
      return json(
        {
          ok: false,
          code: 'CONFLICT',
          message: 'Mesin sudah terhubung. Lepas perangkat dahulu untuk pairing ulang.',
        },
        409,
      );

    // Payload QR hanya berisi identitas booth + kode sekali pakai. Kredensial
    // sesi perangkat dibuat pada penukaran kode di `/api/booth/pair`.
    const payload = JSON.stringify({
      type: 'snapbox.pair',
      boothId: session.boothId,
      code: session.issued.sessionCode,
    });

    return json(
      {
        ok: true,
        boothId: session.boothId,
        expiresAt: session.issued.expiresAt,
        qrDataUrl: qrPngDataUrl(payload),
        manualCode: null,
      },
      200,
    );
  } catch {
    return json({ ok: false, code: 'SERVER_ERROR', message: 'Sesi pairing gagal dibuat.' }, 500);
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, message: 'Metode tidak didukung.' },
    { status: 405, headers: { allow: 'POST', 'cache-control': 'no-store' } },
  );
}
