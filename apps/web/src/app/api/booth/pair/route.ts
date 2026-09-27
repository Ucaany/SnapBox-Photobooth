/**
 * `POST /api/booth/pair` — penukaran kode pairing jadi kredensial perangkat.
 *
 * Ini ujung rantai pairing yang sebelumnya tidak ada. Tanpa endpoint ini,
 * `pairing_tokens.used`/`expires_at`/`attempt_count` tidak punya pembaca maupun
 * penulis, `devices` tidak pernah tersisip, dan `deviceQuota` — yang menghitung
 * `devices` — permanen 0, sehingga pairing tanpa batas di SETIAP tier plan.
 *
 * BARIS PALING PENTING DI BERKAS INI adalah klaim atomik di dalam transaksi:
 *
 *   UPDATE pairing_tokens SET used = true, used_at = now(), attempt_count = attempt_count + 1
 *    WHERE code_hash = $1 AND used = false AND expires_at > now() AND attempt_count < $2
 *   RETURNING booth_id, tenant_id
 *
 * Memvalidasi DAN mengonsumsi dalam SATU pernyataan. Membaca lalu menulis
 * kemudian memberi dua permintaan bersamaan dua-duanya "berhasil", yaitu
 * kehilangan single-use yang menjadi seluruh alasan tabel ini ada.
 * `booth-pairing.test.mjs` mengunci bentuk itu sebagai teks DAN menguji
 * semantiknya terhadap database nyata lewat `verify-security-controls.mts`.
 *
 * ATURAN YANG TIDAK BOLEH DILANGGAR:
 * - `tenantId` dan `boothId` SELALU berasal dari token yang diklaim, tidak pernah
 *   dari body permintaan. Body hanya boleh berisi kode dan fingerprint.
 * - Tidak ada kredensial plaintext yang disimpan: `devices.session_jwt_hash`
 *   menerima SHA-256 token, bukan tokennya.
 * - `deviceQuota` dihitung DI DALAM transaksi yang sama dengan insert `devices`,
 *   supaya dua perangkat tidak bisa melewati batas pada saat bersamaan.
 */
import 'server-only';

import { and, count, eq, isNull, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { REALTIME_CHANNELS } from '@snapbox/shared/events';
import { booths, devices, getDatabase, tenants } from '@snapbox/db';

import { checkAuthRateLimit, authRateLimitKey } from '@/lib/auth/rate-limit';
import { issueDeviceToken, type IssuedDeviceToken } from '@/lib/booth/device-token';
import { claimPairingToken, recordFailedPairingAttempt } from '@/lib/booth/pairing-claim';
import { hashPairingCode } from '@/lib/booth/pairing-token';
import { publishRealtimeEvent } from '@/lib/ceo-dashboard/realtime-server';
import { writeAuditLog } from '@/lib/ceo-dashboard/tenant-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Bentuk fingerprint. Nilainya tidak pernah dicetak kembali ke klien. */
const deviceFingerprintSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, 'Fingerprint perangkat tidak valid.');

const pairRequestSchema = z.object({
  code: z.string().trim().min(16).max(128),
  fingerprint: deviceFingerprintSchema,
  appVersion: z.string().trim().max(40).optional(),
  platform: z.string().trim().max(40).optional(),
  osVersion: z.string().trim().max(120).optional(),
});

function fail(code: string, message: string, status: number): NextResponse {
  return NextResponse.json(
    { ok: false, code, message },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

/**
 * Hasil transaksi penukaran.
 *
 * Dikembalikan dari transaction callback, bukan ditulis ke variabel luar: satu
 * nilai per percobaan membuat jalur kegagalan tidak mungkin lolos tanpa
 * terlihat, dan TypeScript tidak perlu menebak apa yang mungkin terisi setelah
 * callback selesai.
 */
type PairOutcome =
  | {
      readonly kind: 'paired';
      readonly boothId: string;
      readonly tenantId: string;
      readonly deviceId: string;
      readonly token: IssuedDeviceToken;
    }
  | { readonly kind: 'fingerprint_taken' }
  | { readonly kind: 'quota_reached' }
  | { readonly kind: 'token_rejected' };

export async function POST(request: Request) {
  const limit = checkAuthRateLimit(authRateLimitKey(request, 'booth-pair'));
  if (!limit.allowed) {
    return fail('RATE_LIMITED', 'Terlalu banyak permintaan. Coba lagi beberapa saat lagi.', 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('INVALID_INPUT', 'Permintaan tidak valid.', 400);
  }

  const parsed = pairRequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail('INVALID_INPUT', 'Kode atau fingerprint perangkat tidak valid.', 400);
  }

  const { code, fingerprint, appVersion, platform, osVersion } = parsed.data;
  const codeHash = hashPairingCode(code);
  const now = new Date();

  let outcome: PairOutcome;
  try {
    outcome = await getDatabase().transaction(async (tx): Promise<PairOutcome> => {
      // 1. Klaim atomik (satu pernyataan: validasi DAN konsumsi). Nol baris =
      //    kode salah, sudah dipakai, kedaluwarsa, atau sudah habis percobaan.
      const claimed = await claimPairingToken(tx, { codeHash, now });

      if (!claimed) {
        await recordFailedPairingAttempt(tx, { codeHash, now });
        return { kind: 'token_rejected' };
      }

      // 2. Booth harus milik tenant yang diklaim dan belum terpasang. `tenantId`
      //    ikut berasal dari token, jadi cross-tenant tidak bisa diminta.
      const [booth] = await tx
        .select({ id: booths.id, fingerprint: booths.deviceFingerprint })
        .from(booths)
        .where(and(eq(booths.id, claimed.boothId), eq(booths.tenantId, claimed.tenantId)))
        .limit(1);
      if (!booth) return { kind: 'token_rejected' };

      if (booth.fingerprint) return { kind: 'fingerprint_taken' };

      // 3. Fingerprint harus unik global. Booth yang sudah memakai fingerprint
      //    yang sama berarti token dicuri atau perangkat lama belum dilepas.
      const [duplicate] = await tx
        .select({ id: booths.id })
        .from(booths)
        .where(and(eq(booths.deviceFingerprint, fingerprint), ne(booths.id, booth.id)))
        .limit(1);
      if (duplicate) return { kind: 'fingerprint_taken' };

      // 4. Kuota perangkat, dihitung di dalam transaksi yang sama dengan insert.
      const [tenant] = await tx
        .select({ quota: tenants.deviceQuota, addOn: tenants.addOnDevices })
        .from(tenants)
        .where(eq(tenants.id, claimed.tenantId))
        .limit(1);
      if (!tenant) return { kind: 'token_rejected' };

      const [total] = await tx
        .select({ total: count() })
        .from(devices)
        .where(and(eq(devices.tenantId, claimed.tenantId), eq(devices.isRevoked, false)));
      if (Number(total?.total ?? 0) >= tenant.quota + tenant.addOn) {
        return { kind: 'quota_reached' };
      }

      // 5. Terbitkan kredensial, simpan HASH-nya, dan tautkan fingerprint ke booth.
      const token = issueDeviceToken(now.getTime());

      const [device] = await tx
        .insert(devices)
        .values({
          boothId: booth.id,
          tenantId: claimed.tenantId,
          deviceFingerprint: fingerprint,
          appVersion: appVersion ?? null,
          platform: platform ?? null,
          osVersion: osVersion ?? null,
          lastHeartbeatAt: now,
          sessionJwtHash: token.tokenHash,
        })
        .returning({ id: devices.id });
      if (!device) return { kind: 'token_rejected' };

      await tx
        .update(booths)
        .set({
          deviceFingerprint: fingerprint,
          appVersion: appVersion ?? null,
          platform: platform ?? null,
          status: 'ONLINE',
          lastHeartbeatAt: now,
          updatedAt: now,
        })
        .where(and(eq(booths.id, booth.id), isNull(booths.deviceFingerprint)));

      return {
        kind: 'paired',
        boothId: booth.id,
        tenantId: claimed.tenantId,
        deviceId: device.id,
        token,
      };
    });
  } catch {
    return fail('SERVER_ERROR', 'Pairing gagal diproses.', 500);
  }

  if (outcome.kind === 'fingerprint_taken') {
    return fail('CONFLICT', 'Perangkat ini sudah terpasang. Lepas perangkat lama lebih dulu.', 409);
  }

  if (outcome.kind === 'quota_reached') {
    return fail('LIMIT_REACHED', 'Batas perangkat pada plan tenant sudah tercapai.', 409);
  }

  if (outcome.kind !== 'paired') {
    // Satu pesan untuk kode salah, kedaluwarsa, sudah dipakai, dan habis
    // percobaan. Membedakan keduanya akan memberi oracle: "kode ini benar tapi
    // terpakai" adalah informasi yang tidak boleh bocor.
    return fail('PAIRING_REJECTED', 'Kode pairing tidak valid atau sudah kedaluwarsa.', 401);
  }

  // 6. Jejak audit dan event realtime, DI LUAR transaksi: keduanya
  //    best-effort, dan pairing yang sudah berhasil tidak boleh gagal gara-gara
  //    kanal telemetry. Audit high-risk lain memakai `writeAuditLogTx`; di sini
  //    mutasi sudah selesai dan tidak ada yang bisa di-rollback tanpa membatalkan
  //    pemasangan perangkat, jadi `writeAuditLog` (best-effort) yang tepat.
  void writeAuditLog({
    actorUserId: null,
    actorEmail: 'booth-device',
    actorRole: null,
    tenantId: outcome.tenantId,
    action: 'device.paired',
    resourceType: 'device',
    resourceId: outcome.deviceId,
    metadata: {
      boothId: outcome.boothId,
      fingerprintPrefix: fingerprint.slice(0, 8),
    },
  });

  try {
    await publishRealtimeEvent({
      channel: REALTIME_CHANNELS.booth(outcome.boothId),
      event: {
        eventId: `device-paired:${outcome.deviceId}`,
        name: 'DEVICE_PAIRED',
        version: 1,
        timestamp: now.toISOString(),
        tenantId: outcome.tenantId,
        boothId: outcome.boothId,
        deviceId: outcome.deviceId,
        payload: {},
      },
    });
  } catch {
    // Realtime gagal bukan alasan gagalkan pairing.
  }

  return NextResponse.json(
    {
      ok: true,
      token: outcome.token.token,
      expiresAt: outcome.token.expiresAt,
      boothId: outcome.boothId,
    },
    { status: 200, headers: { 'cache-control': 'no-store' } },
  );
}

export function GET() {
  return NextResponse.json(
    { ok: false, message: 'Metode tidak didukung.' },
    { status: 405, headers: { allow: 'POST', 'cache-control': 'no-store' } },
  );
}
