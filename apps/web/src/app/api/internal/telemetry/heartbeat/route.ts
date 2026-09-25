/**
 * `POST /api/internal/telemetry/heartbeat` — heartbeat komponen dan job cron.
 *
 * Dipanggil job terjadwal (Supabase pg_cron/worker) SETELAH satu percobaan
 * selesai. Endpoint tidak memakai sesi; otorisasi memakai shared secret di
 * header `x-snapbox-heartbeat-secret`, dibandingkan constant-time.
 *
 * Ada dua mode:
 * 1. Body heartbeat biasa (`{checkKey, component, status, ...}`) dari job yang
 *    sudah tahu hasilnya.
 * 2. `{probe: "config"}` atau `{probe: "sentry"}`: endpoint menjalankan probe
 *    dependency dan menulis heartbeat-nya sendiri. Ini jalur yang dipakai cron
 *    supaya halaman CEO tidak perlu memanggil jaringan eksternal saat render.
 *
 * Aturan yang mengikat:
 * - Tanpa `HEARTBEAT_SECRET`, endpoint gagal TERTUTUP (503).
 * - `checkKey` unik: kiriman ulang menimpa baris yang sama (idempotent).
 * - `detail` disaring oleh service; secret/token tidak tersimpan.
 */
import { NextResponse } from 'next/server';

import { healthHeartbeatSchema } from '@/lib/ceo-dashboard/health-security-contract';
import { runConfigHealthProbes } from '@/lib/ceo-dashboard/health-probes';
import { recordHealthHeartbeat } from '@/lib/ceo-dashboard/health-security-server';
import { runSentryHealthProbe } from '@/lib/ceo-dashboard/sentry-health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 8 * 1024;

/** Mode probe yang didukung; selain ini ditolak. */
const PROBE_MODES = ['config', 'sentry'] as const;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  const secret = process.env.HEARTBEAT_SECRET;
  if (!secret) {
    return json(503, { ok: false, message: 'Endpoint heartbeat belum dikonfigurasi.' });
  }

  const provided = request.headers.get('x-snapbox-heartbeat-secret') ?? '';
  if (!safeEqual(provided, secret)) {
    return json(401, { ok: false, message: 'Tanda tangan heartbeat tidak valid.' });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { ok: false, message: 'Body terlalu besar.' });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, message: 'Body bukan JSON.' });
  }

  // Mode probe: cron meminta endpoint menjalankan pemeriksaan dan menulis
  // heartbeat-nya sendiri.
  const probe = readProbeMode(body);
  if (probe) {
    if (probe === 'config') await runConfigHealthProbes();
    else await runSentryHealthProbe();

    return json(200, { ok: true, probe });
  }

  const parsed = healthHeartbeatSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { ok: false, message: 'Heartbeat tidak sesuai skema.' });
  }

  await recordHealthHeartbeat(parsed.data);

  return json(200, { ok: true });
}

/** Mode probe dari body, atau `null` bila bukan permintaan probe. */
function readProbeMode(body: unknown): (typeof PROBE_MODES)[number] | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const value = (body as { probe?: unknown }).probe;
  return typeof value === 'string' && (PROBE_MODES as readonly string[]).includes(value)
    ? (value as (typeof PROBE_MODES)[number])
    : null;
}

export function GET() {
  return json(405, { ok: false, message: 'Metode tidak didukung.' });
}
