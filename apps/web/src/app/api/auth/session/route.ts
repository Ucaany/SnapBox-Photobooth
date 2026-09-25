/**
 * `POST /api/auth/session` — tukar ID token Firebase menjadi cookie sesi.
 *
 * Alur (PRD Task 1.2): Firebase Client SDK login di browser -> ID token dikirim
 * ke sini -> `firebase-admin` memverifikasi -> DB memutuskan otorisasi ->
 * route menerbitkan cookie HttpOnly.
 *
 * Route ini adalah SATU-SATUNYA pintu penerbitan sesi. Cookie tidak pernah bisa
 * dipasang dari query/body, dan ID token tidak pernah disimpan.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  AuthorizationError,
  buildSessionFromIdToken,
  touchLastLogin,
} from '@/lib/auth/authorization';
import { createSession, sessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { safeHomeForRole } from '@/lib/auth/route-policy';
import { checkAuthRateLimit, authRateLimitKey } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Firestore ID token panjang, tetapi batas atas menjaga body tidak dipakai
 * untuk menghabiskan memori. 8 KiB jauh di atas token nyata (~1 KiB).
 */
const sessionRequestSchema = z.object({
  idToken: z.string().min(20).max(8192),
});

/** Pesan generik untuk kegagalan otorisasi; tidak membocorkan sebab spesifik. */
const GENERIC_AUTH_FAILURE = 'Login tidak dapat diproses. Periksa email dan kata sandi Anda.';

/**
 * Memastikan permintaan datang dari origin sendiri.
 *
 * Ini penting khusus untuk endpoint penerbit cookie. `SameSite=Lax` tetap
 * mengirim cookie pada navigasi POST lintas situs level atas, jadi tanpa
 * pemeriksaan ini penyerang yang bisa memicu POST dari browser korban dapat
 * mengikat cookie sesi korban ke ID token milik penyerang (login CSRF), karena
 * cookie dipasang dari RESPONS, bukan dari state permintaan.
 *
 * Klien non-browser (curl, test) mengirim tanpa `Origin` dan tidak mungkin
 * menjadi sasaran CSRF, jadi ketiadaan header diizinkan. Bila header ada, ia
 * WAJIB cocok host.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/**
 * Apakah kode kegagalan rinci boleh dibocorkan ke klien.
 *
 * Hanya saat pengembangan. Di production, kode rinci mengubah endpoint menjadi
 * oracle status akun/tenant bagi siapa pun yang memegang ID token sendiri.
 */
function revealFailureReasons(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function jsonError(status: number, message: string, code?: string) {
  return NextResponse.json(
    { ok: false, message, ...(code ? { code } : {}) },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

/**
 * Menerima ID token dan menerbitkan cookie sesi.
 *
 * Respons selalu `no-store`: baik sukses (memuat tujuan redirect) maupun gagal
 * tidak boleh di-cache oleh CDN/browser.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, GENERIC_AUTH_FAILURE, 'CROSS_ORIGIN');
  }

  // Rate limit sesuai PRD Bab 8.2 untuk `/api/auth/*`.
  const limit = checkAuthRateLimit(authRateLimitKey(request, 'session'));
  if (!limit.allowed) {
    return jsonError(
      429,
      'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.',
      'RATE_LIMITED',
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Permintaan tidak valid.', 'INVALID_BODY');
  }

  const parsed = sessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, 'Permintaan tidak valid.', 'INVALID_BODY');
  }

  let session;
  try {
    session = await buildSessionFromIdToken(parsed.data.idToken);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      // Penolakan otorisasi ≠ kredensial salah, tetapi pesan untuk klien tetap
      // satu bentuk agar tidak bisa dipakai untuk enumerasi akun/tenant.
      // Kode rinci (CLAIMS_STALE, TENANT_BLOCKED, SUBSCRIPTION_INACTIVE, ...)
      // hanya berguna saat pengembangan: pemegang ID token bisa memakainya
      // untuk memetakan status akun/tenant sendiri, jadi di production kode
      // dikoarsakan menjadi satu nilai.
      return jsonError(
        error.httpStatus,
        GENERIC_AUTH_FAILURE,
        revealFailureReasons() ? error.code : 'AUTH_FAILED',
      );
    }

    // Kegagalan Firebase (token invalid, expired, project salah) atau
    // misconfiguration server. Jangan pernah mengembalikan detail Firebase.
    return jsonError(401, GENERIC_AUTH_FAILURE, 'TOKEN_INVALID');
  }

  const cookie = await createSession(session);
  await touchLastLogin(session.userId);

  const response = NextResponse.json(
    { ok: true, role: session.role, redirectTo: safeHomeForRole(session.role) },
    { status: 200, headers: { 'cache-control': 'no-store' } },
  );

  response.cookies.set(cookie.name, cookie.value, sessionCookieOptions(cookie.maxAge));

  return response;
}

/** Menghapus cookie sesi (logout sisi server). */
export async function DELETE() {
  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: { 'cache-control': 'no-store' } },
  );

  // maxAge 0 + atribut identik memastikan cookie benar-benar dihapus, bukan
  // tertinggal sebagai salinan dengan nama sama dan path berbeda.
  response.cookies.set(SESSION_COOKIE_NAME, '', sessionCookieOptions(0));

  return response;
}

/** Metode lain tidak dilayani; sebutkan yang didukung supaya tidak ambigu. */
export function GET() {
  return NextResponse.json(
    { ok: false, message: 'Metode tidak didukung.' },
    { status: 405, headers: { allow: 'POST, DELETE', 'cache-control': 'no-store' } },
  );
}
