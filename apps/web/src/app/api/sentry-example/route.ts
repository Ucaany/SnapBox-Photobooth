import { NextResponse } from 'next/server';

/**
 * Route verifikasi Sentry (Fase 0).
 *
 * Route ini adalah pemicu yang bisa dibuktikan: memanggilnya dengan sengaja
 * melempar error dari server component sehingga terlihat muncul di Sentry UI
 * dan mengonfirmasi pipeline (SDK -> DSN -> dashboard) benar-benar bekerja.
 *
 * Route ini sudah diberi gate: di produksi ia hanya mengembalikan 404, sehingga
 * tidak akan pernah memicu error publik. Pelemparan error hanya aktif di luar
 * produksi agar verifikasi Fase 0 tetap bisa dijalankan secara lokal.
 *
 * Sebaiknya tetap DIHAPUS di akhir Fase 0 karena fungsinya hanya untuk
 * verifikasi sekali pakai.
 */

// ponytail: gate NODE_ENV ini cukup untuk menutup endpoint di produksi; hapus
// seluruh route saat Fase 0 selesai.

export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ status: 'disabled' }, { status: 404 });
  }

  throw new Error('SnapBox Sentry verification error');
}
