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

import { buildContentSecurityPolicy, generateCspNonce } from '@/lib/auth/csp';
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
   * Middleware berjalan untuk SEMUA halaman, bukan hanya rute privat, karena
   * Content-Security-Policy di sini memakai nonce yang berbeda tiap request dan
   * tidak bisa ditulis sebagai header statis di `next.config.ts`. Aset statis
   * dikecualikan: tidak ada HTML di sana, jadi tidak ada yang perlu dilindungi,
   * dan menjalankan Web Crypto untuk setiap aset menambah latency tanpa
   * manfaat.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};

/**
 * Menyisipkan CSP per-request ke respons mana pun yang keluar dari middleware.
 *
 * Dipisah karena setiap jalur return (next, redirect, rewrite) harus membawa
 * header yang sama; lupa di satu jalur berarti CSP hilang tepat di halaman yang
 * paling menarik untuk diserang.
 */
function withCsp(request: NextRequest, response: NextResponse, nonce: string): NextResponse {
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce, request));
  return response;
}

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

  // Nonce dibuat per request, di awal, supaya SEMUA jalur return bisa
  // menyertakannya. HANYA satu CSP per respons: header di-set di sini, bukan di
  // `next.config.ts`, supaya tidak ada dua CSP yang saling meniadakan.
  const nonce = generateCspNonce();
  request.headers.set('x-nonce', nonce);

  const session = await verifySession(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  // Sudah login lalu membuka `/login`: alihkan ke tujuan yang sesuai perannya.
  // Peran tanpa halaman (Fase 1: OWNER/STAFF) dibiarkan melihat form.
  if (pathname === '/login') {
    if (!session) return withCsp(request, NextResponse.next(), nonce);

    const next = safeRedirectPath(request.nextUrl.searchParams.get('next'));
    const home = next ?? safeHomeForRole(session.role);

    if (!home) return withCsp(request, NextResponse.next(), nonce);

    return withCsp(request, NextResponse.redirect(new URL(home, request.url)), nonce);
  }

  if (!isProtectedPath(pathname)) return withCsp(request, NextResponse.next(), nonce);

  // 1. Tidak ada sesi sah (hilang, rusak, tanda tangan salah, kedaluwarsa).
  if (!session) {
    return withCsp(request, NextResponse.redirect(loginUrl(request)), nonce);
  }

  const rule = findRouteRule(pathname);

  // 2. Peran tidak sesuai untuk prefix ini.
  if (!rule || !rule.roles.includes(session.role)) {
    // Peran sendiri punya halaman? Arahkan ke sana, jangan ke 403.
    const home = safeHomeForRole(session.role);
    if (home && home !== pathname) {
      return withCsp(request, NextResponse.redirect(new URL(home, request.url)), nonce);
    }

    return withCsp(request, NextResponse.redirect(new URL('/unauthorized', request.url)), nonce);
  }

  // 3. Gate langganan. Owner tetap dapat membuka pemulihan langganan.
  if (session.subscription !== 'OK' && !isSubscriptionExempt(pathname)) {
    if (session.role === 'OWNER') {
      return withCsp(
        request,
        NextResponse.redirect(new URL('/owner-dashboard/subscription', request.url)),
        nonce,
      );
    }

    const unauthorized = new URL('/unauthorized', request.url);
    unauthorized.searchParams.set('reason', 'subscription');
    return withCsp(request, NextResponse.redirect(unauthorized), nonce);
  }

  return withCsp(request, NextResponse.next(), nonce);
}
