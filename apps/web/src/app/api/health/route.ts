import { NextResponse } from 'next/server';

/**
 * Health check (PRD Bab 8.6). Dipantau Cloudflare dan uptime monitor.
 *
 * Selalu mengembalikan 200 bila proses hidup, dengan rincian per dependensi
 * supaya kegagalan sebagian bisa dibedakan dari kegagalan total. Endpoint ini
 * DILARANG memuat secret atau versi kredensial apa pun.
 *
 * ponytail: baru memeriksa konektivitas DB. Cek Supabase Realtime, Firebase, dan
 * queue webhook ditambahkan di Fase 3 saat dependensinya sudah terpasang.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CheckResult {
  readonly name: string;
  readonly status: 'ok' | 'skipped' | 'error';
  readonly detail?: string;
}

async function checkDatabase(): Promise<CheckResult> {
  if (!process.env.DATABASE_URL) {
    return { name: 'database', status: 'skipped', detail: 'DATABASE_URL belum diset.' };
  }

  try {
    const { getDatabase } = await import('@snapbox/db/client');
    const db = getDatabase();
    await db.execute('select 1');
    return { name: 'database', status: 'ok' };
  } catch (error) {
    return {
      name: 'database',
      status: 'error',
      detail: error instanceof Error ? error.message : 'Koneksi gagal.',
    };
  }
}

export async function GET() {
  const checks = await Promise.all([checkDatabase()]);
  const degraded = checks.some((check) => check.status === 'error');

  return NextResponse.json(
    {
      status: degraded ? 'degraded' : 'ok',
      service: 'snapbox-web',
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: 200,
      headers: { 'cache-control': 'no-store' },
    },
  );
}
