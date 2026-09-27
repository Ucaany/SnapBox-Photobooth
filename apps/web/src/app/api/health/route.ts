import { NextResponse } from 'next/server';

/**
 * Health check (PRD Bab 8.6). Dipantau Cloudflare dan uptime monitor.
 *
 * Rincian per dependensi dikembalikan supaya kegagalan sebagian bisa dibedakan
 * dari kegagalan total. Endpoint ini DILARANG memuat secret maupun versi
 * kredensial apa pun — termasuk yang tidak sengaja bocor lewat pesan error.
 *
 * ATURAN RESPON (BE-018).
 *
 * 1. TIDAK ADA TEKS DRIVER DI RESPON. Rute ini publik, `cache: no-store`, dan
 *    pernah mengembalikan HTTP 200 bahkan saat gagal. Pesan error Postgres dan
 *    Supabase bisa memuat host, port, nama user, nama database, dan sebagian
 *    hermano path. Wentahnya adalah peta, bukan pesan. Yang dikembalikan ke
 *    klien sekarang hanya `Akses database gagal.`; teks aslinya dicatat
 *    server-side di `console.error` untuk operator, tidak pernah ke body.
 *
 * 2. KEGAGALAN = HTTP 503, BUKAN 200. Sebelumnya route ini selalu 200, jadi
 *    monitor tidak pernah bisa membedakan "hidup tapi database mati" dari
 *    "sehat". Uptime probe yang hanya memeriksa "ada respons" akan terus hijau
 *    selama database mati total. `skipped` (DATABASE_URL belum di-set) tetap
 *    200 karena itu konfigurasi, bukan kegagalan.
 *
 * 3. TIDAK ADA VERSI KREDENSIAL. Nama variabel dan status tidak di sini; nilai
 *    tidak pernah, di cabang mana pun.
 *
 * CATATAN INFRA. `infra/cloudflare/waf-custom-rules.json` masih mengecualikan
 * `/api/health` dari rate limit dan challenge. Itu keputusan sendiri dan tidak
 * diubah di sini; yang penting, pengecualian itu tidak lagi membocorkan apa
 * pun karena isinya sudah generik, dan probe uptime harus tetap bisa
 * menjangkau endpoint.
 *
 * ponytail: baru memeriksa konektivitas DB. Cek Supabase Realtime, Firebase, dan
 * queue webhook ditambahkan di Fase 3 saat dependensinya sudah terpasang.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CheckResult {
  readonly name: string;
  readonly status: 'ok' | 'skipped' | 'error';
  /** Selalu generik. Lihat aturan 1 di header. */
  readonly detail?: string;
}

const NO_STORE = { 'cache-control': 'no-store' } as const;

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
    // Teks asli boleh masuk log server: operator butuh nama host dan user untuk
    // memperbaiki. Yang dilarang adalah mengirimnya ke klien.
    console.error('[health] pemeriksaan konektivitas database gagal:', error);
    return { name: 'database', status: 'error', detail: 'Akses database gagal.' };
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
      // Lihat aturan 2 di header. 503 supaya monitor benar-benar melihatnya.
      status: degraded ? 503 : 200,
      headers: NO_STORE,
    },
  );
}
