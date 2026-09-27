/**
 * `POST /api/booth/heartbeat` — tanda hidup perangkat booth.
 *
 * Sebelum endpoint ini, `booths.last_heartbeat_at` dan `devices.last_heartbeat_at`
 * tidak punya satu pun penulis di seluruh repo. Hanya pembaca. Akibatnya setiap
 * booth permanen menampilkan OFFLINE atau UNPAIRED lewat `deriveDisplayStatus`,
 * `DEVICE_ONLINE`/`BOOTH_ONLINE` tidak pernah bisa terjadi, dan alerting
 * "booth offline sejak 15 menit" (PRD Bab 6.L) tidak berfungsi sama sekali.
 *
 * KEPUTUSAN INTERVAL (konflik PRD yang harus diselesaikan). PRD Bab 3.3 menyebut
 * heartbeat + cron offline 90 detik; PRD Bab 4.11 menyebut heartbeat 30 detik
 * (15 detik untuk Growth/Enterprise). Keduanya tidak bisa berlaku bersamaan:
 * heartbeat 15 detik dengan ambang offline 90 detik hanya menambah beban tanpa
 * menambah ketepatan. Yang dipakai: **ambang offline 90 detik** (satu-satunya
 * angka yang sudah jadi konstanta di `machine-contract.ts`) dan heartbeat
 * sesingkat mungkin — 30 detik Growth/Enterprise, 60 detik Starter. Ambang 15
 * detik tidak dipakai; kalau nanti dipakai, `HEARTBEAT_OFFLINE_SECONDS` harus
 * ikut turun, dan angka itu HANYA boleh dibaca dari satu tempat.
 *
 * Kenapa tidak ada cron offline di sini: keputusan kepemilikan job/retensi
 * (B-22) belum diambil, dan membuat cron kedua yang tidak terjadwal hanya
 * menambah satu sumber "OFFLINE yang tidak pernah diproses". Sweep-nya
 * dijalankan di dalam heartbeat: setiap booth yang masih hidup menyapu booth
 * lain di tenant-nya yang sudah basi. Jadi booth yang diam tetap turun ke
 * OFFLINE tanpa tindakan manusia, tanpa job baru.
 */
import 'server-only';

import { and, eq, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { REALTIME_CHANNELS } from '@snapbox/shared/events';
import { booths, devices, getDatabase } from '@snapbox/db';

import {
  authRateLimitKey,
  boothDeviceRateLimitKey,
  checkAuthRateLimit,
  checkBoothDeviceRateLimit,
} from '@/lib/auth/rate-limit';
import { authenticateDevice } from '@/lib/booth/device-auth';
import { HEARTBEAT_OFFLINE_SECONDS } from '@/lib/owner-dashboard/machine-contract';
import { publishRealtimeEvent } from '@/lib/ceo-dashboard/realtime-server';
import { writeAuditLog } from '@/lib/ceo-dashboard/tenant-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const heartbeatRequestSchema = z.object({
  token: z.string().min(20).max(256),
  fingerprint: z
    .string()
    .trim()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
  paperCount: z.number().int().nonnegative().max(100_000).optional(),
  uptimeSeconds: z.number().int().nonnegative().max(10_000_000).optional(),
});

function fail(code: string, message: string, status: number): NextResponse {
  return NextResponse.json(
    { ok: false, code, message },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const limit = checkAuthRateLimit(authRateLimitKey(request, 'booth-heartbeat'));
  if (!limit.allowed) {
    return fail('RATE_LIMITED', 'Terlalu banyak permintaan.', 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('INVALID_INPUT', 'Permintaan tidak valid.', 400);
  }

  const parsed = heartbeatRequestSchema.safeParse(body);
  if (!parsed.success) return fail('INVALID_INPUT', 'Permintaan tidak valid.', 400);

  // `boothId` dan `tenantId` SELALU berasal dari baris `devices` yang cocok dengan
  // hash token dan fingerprint. Body tidak pernah dipercaya untuk menentukan
  // perangkat mana yang bicara.
  const device = await authenticateDevice(parsed.data.token, parsed.data.fingerprint);
  if (!device) return fail('UNAUTHORIZED', 'Perangkat tidak dikenal atau sudah dicabut.', 401);

  // Bucket kedua: per fingerprint yang SUDAH TERVERIFIKASI. Nilai ini dibaca
  // dari `devices.device_fingerprint`, bukan dari body permintaan, jadi
  // mengacak-acak fingerprint di body tidak membuka jendela baru. Bucket per IP
  // di atas tetap ada sebagai pertahanan terhadap pemutaran fingerprint.
  const deviceLimit = checkBoothDeviceRateLimit(
    boothDeviceRateLimitKey('booth-heartbeat', device.fingerprint),
  );
  if (!deviceLimit.allowed) {
    return fail('RATE_LIMITED', 'Terlalu banyak permintaan.', 429);
  }

  const now = new Date();
  const db = getDatabase();

  const [booth] = await db
    .select({ status: booths.status, lastHeartbeatAt: booths.lastHeartbeatAt })
    .from(booths)
    .where(and(eq(booths.id, device.boothId), eq(booths.tenantId, device.tenantId)))
    .limit(1);
  if (!booth) return fail('NOT_FOUND', 'Booth tidak ditemukan.', 404);

  const wasOffline =
    booth.status !== 'ONLINE' ||
    booth.lastHeartbeatAt === null ||
    now.getTime() - booth.lastHeartbeatAt.getTime() > HEARTBEAT_OFFLINE_SECONDS * 1000;

  await db.transaction(async (tx) => {
    await tx
      .update(devices)
      .set({ lastHeartbeatAt: now, uptimeSeconds: parsed.data.uptimeSeconds ?? null })
      .where(eq(devices.id, device.deviceId));

    await tx
      .update(booths)
      .set({
        lastHeartbeatAt: now,
        ...(parsed.data.paperCount === undefined ? {} : { paperCount: parsed.data.paperCount }),
        // Status tidak pernah diturunkan ke MAINTENANCE/UNPAIRED oleh heartbeat:
        // keduanya adalah keputusan Owner, bukan laporan perangkat.
        status:
          booth.status === 'MAINTENANCE' || booth.status === 'UNPAIRED' ? booth.status : 'ONLINE',
        updatedAt: now,
      })
      .where(and(eq(booths.id, device.boothId), eq(booths.tenantId, device.tenantId)));
  });

  if (wasOffline) {
    // Event hanya saat TRANSISI, bukan setiap heartbeat; kalau tidak, channel
    // realtime akan flooded dan handler harus idempoten tanpa alasan.
    void publishLifecycleEvent('BOOTH_ONLINE', device, now).catch(() => {});
  }

  // Sweep tenant: booth yang tidak lagi berdetak turun ke OFFLINE.
  await sweepStaleBooths(device.tenantId, now);

  return NextResponse.json(
    { ok: true, boothId: device.boothId, serverTime: now.toISOString() },
    { status: 200, headers: { 'cache-control': 'no-store' } },
  );
}

async function publishLifecycleEvent(
  name: 'BOOTH_ONLINE' | 'BOOTH_OFFLINE',
  device: { boothId: string; tenantId: string; deviceId: string },
  at: Date,
): Promise<void> {
  await publishRealtimeEvent({
    channel: REALTIME_CHANNELS.booth(device.boothId),
    event: {
      eventId: `${name.toLowerCase()}:${device.boothId}:${at.getTime()}`,
      name,
      version: 1,
      timestamp: at.toISOString(),
      tenantId: device.tenantId,
      boothId: device.boothId,
      deviceId: device.deviceId,
      payload: {},
    },
  });
}

/**
 * Menurunkan booth yang diam ke OFFLINE dan menerbitkan `BOOTH_OFFLINE`.
 *
 * Hanya menyentuh baris `ONLINE` yang `last_heartbeat_at`-nya sudah melewati
 * `HEARTBEAT_OFFLINE_SECONDS`, jadi sweep idempoten dan tidak menimpa
 * MAINTENANCE/UNPAIRED yang ditetapkan Owner.
 */
export async function sweepStaleBooths(tenantId: string, now: Date = new Date()): Promise<number> {
  const db = getDatabase();
  const cutoff = new Date(now.getTime() - HEARTBEAT_OFFLINE_SECONDS * 1000);

  const stale = await db.transaction(async (tx) =>
    tx
      .update(booths)
      .set({ status: 'OFFLINE', updatedAt: now })
      .from(devices)
      .where(
        and(
          eq(booths.tenantId, tenantId),
          eq(booths.status, 'ONLINE'),
          lt(booths.lastHeartbeatAt, cutoff),
          eq(devices.boothId, booths.id),
          eq(devices.isRevoked, false),
        ),
      )
      .returning({ id: booths.id }),
  );

  for (const booth of stale) {
    void publishRealtimeEvent({
      channel: REALTIME_CHANNELS.booth(booth.id),
      event: {
        eventId: `booth-offline:${booth.id}:${now.getTime()}`,
        name: 'BOOTH_OFFLINE',
        version: 1,
        timestamp: now.toISOString(),
        tenantId,
        boothId: booth.id,
        deviceId: null,
        payload: {},
      },
    }).catch(() => {});
    void writeAuditLog({
      actorUserId: null,
      actorEmail: 'system-heartbeat',
      actorRole: null,
      tenantId,
      action: 'booth.offline',
      resourceType: 'booth',
      resourceId: booth.id,
      metadata: { thresholdSeconds: HEARTBEAT_OFFLINE_SECONDS },
    });
  }

  return stale.length;
}

export function GET() {
  return NextResponse.json(
    { ok: false, message: 'Metode tidak didukung.' },
    { status: 405, headers: { allow: 'POST', 'cache-control': 'no-store' } },
  );
}
