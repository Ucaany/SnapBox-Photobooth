/**
 * `POST /api/internal/telemetry/waf` — ingest event WAF terverifikasi.
 *
 * Cloudflare (atau Transform Rule/Worker tepercaya) meneruskan ringkasan event
 * ke sini. Endpoint SENGAJA tidak memakai sesi: pemanggil adalah mesin, bukan
 * pengguna. Otorisasi memakai shared secret di header `x-snapbox-waf-secret`,
 * dibandingkan constant-time.
 *
 * Aturan yang mengikat:
 * - Bila `WAF_INGEST_SECRET` belum diset, endpoint gagal TERTUTUP (503), bukan
 *   menerima event tanpa verifikasi.
 * - Body dibatasi ukuran dan divalidasi Zod; field tak dikenal ditolak.
 * - IP klien di-hash oleh service, payload mentah tidak disimpan.
 * - Idempotent lewat `providerEventId`; kiriman ulang mengembalikan 200.
 */
import { NextResponse } from 'next/server';

import { wafEventSchema } from '@/lib/ceo-dashboard/health-security-contract';
import { recordWafEvent } from '@/lib/ceo-dashboard/health-security-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Batas body; event WAF ringkas, 16 KiB sudah longgar. */
const MAX_BODY_BYTES = 16 * 1024;

/** Perbandingan constant-time sederhana; panjang beda langsung gagal. */
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
  const secret = process.env.WAF_INGEST_SECRET;
  if (!secret) {
    // Gagal tertutup: tanpa secret tidak ada jalur ingest yang sah.
    return json(503, { ok: false, message: 'Ingest WAF belum dikonfigurasi.' });
  }

  const provided = request.headers.get('x-snapbox-waf-secret') ?? '';
  if (!safeEqual(provided, secret)) {
    return json(401, { ok: false, message: 'Tanda tangan ingest tidak valid.' });
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

  const parsed = wafEventSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { ok: false, message: 'Event WAF tidak sesuai skema.' });
  }

  const result = await recordWafEvent(parsed.data);
  if (result === 'rejected') {
    return json(500, { ok: false, message: 'Event tidak dapat disimpan.' });
  }

  return json(200, { ok: true, status: result });
}

export function GET() {
  return json(405, { ok: false, message: 'Metode tidak didukung.' });
}
