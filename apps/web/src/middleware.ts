/**
 * Middleware rute privat (PRD Bab 8.2 baris 813: "Middleware `middleware.ts`
 * (edge runtime) route protection").
 *
 * PEMBAGIAN TANGGUNG JAWAB — ini keputusan arsitektur, bukan detail:
 *
 * Middleware berjalan di Edge runtime, sehingga DILARANG memakai
 * `firebase-admin` (butuh Node API) dan DILARANG membuka koneksi Postgres.
 * Karena itu middleware TIDAK memverifikasi ulang ID token Firebase dan tidak
 * memeriksa DB. Yang dilakukannya:
 *
 * 1. Memverifikasi tanda tangan HMAC cookie sesi (Web Crypto).
 * 2. Memeriksa peran terhadap prefix rute.
 * 3. Memeriksa snapshot gate langganan.
 * 4. Mengalihkan ke `/login` atau `/unauthorized`.
 *
 * Middleware adalah GATE AWAL untuk UX dan pertahanan berlapis, BUKAN
 * otorisasi final. Setiap route handler, server action, dan layout privat yang
 * dilindungi WAJIB mengulang pemeriksaan ke DB (`verifySession` + query), karena
 * snapshot di cookie bisa basi: perubahan peran, suspend tenant, atau langganan
 * yang habis tidak langsung mengubah cookie yang sudah terbit.
 */
import { NextResponse, type NextRequest } from 'next/server';

import {
  findRouteRule,
  isProtectedPath,
  isSubscriptionExempt,
  safeHomeForRole,
  safeRedirectPath,
} from '@/lib/auth/route-policy';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session';

export const config = {
  /**
   * Hanya rute privat yang dicek. Mengecualikan aset statis dan API supaya
   * middleware tidak berjalan pada setiap permintaan file.
   *
   * `/api/` sengaja tidak dicek di sini: setiap route API memverifikasi
   * sesinya sendiri, dan redirect HTML dari middleware akan membingungkan
   * pemanggil non-browser (fetch).
   */
  matcher: [
    '/ceo-dashboard/:path*',
    '/owner-dashboard/:path*',
    '/staff-dashboard/:path*',
    '/dashboard/:path*',
    '/login',
  ],
};

/** Membangun URL login dengan `next` yang sudah dipastikan aman. */
function loginUrl(request: NextRequest): URL {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';

  const target = safeRedirectPath(request.nextUrl.pathname + request.nextUrl.search);
  if (target) url.searchParams.set('next', target);

  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await verifySession(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  // Sudah login lalu membuka `/login`: alihkan ke tujuan yang sesuai perannya.
  // Peran tanpa halaman (Fase 1: OWNER/STAFF) dibiarkan melihat form.
  if (pathname === '/login') {
    if (!session) return NextResponse.next();

    const next = safeRedirectPath(request.nextUrl.searchParams.get('next'));
    const home = next ?? safeHomeForRole(session.role);

    if (!home) return NextResponse.next();

    return NextResponse.redirect(new URL(home, request.url));
  }

  if (!isProtectedPath(pathname)) return NextResponse.next();

  // 1. Tidak ada sesi sah (hilang, rusak, tanda tangan salah, kedaluwarsa).
  if (!session) {
    return NextResponse.redirect(loginUrl(request));
  }

  const rule = findRouteRule(pathname);

  // 2. Peran tidak sesuai untuk prefix ini.
  if (!rule || !rule.roles.includes(session.role)) {
    // Peran sendiri punya halaman? Arahkan ke sana, jangan ke 403.
    const home = safeHomeForRole(session.role);
    if (home && home !== pathname) {
      return NextResponse.redirect(new URL(home, request.url));
    }

    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  // 3. Gate langganan. Owner tetap dapat membuka pemulihan langganan.
  if (session.subscription !== 'OK' && !isSubscriptionExempt(pathname)) {
    if (session.role === 'OWNER') {
      return NextResponse.redirect(new URL('/owner-dashboard/subscription', request.url));
    }

    const unauthorized = new URL('/unauthorized', request.url);
    unauthorized.searchParams.set('reason', 'subscription');
    return NextResponse.redirect(unauthorized);
  }

  return NextResponse.next();
}
