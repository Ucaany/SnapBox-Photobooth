/**
 * `POST /api/auth/staff-pin` — jalur masuk Staff tanpa kata sandi Firebase.
 *
 * PRD Task 1.2 meminta mode PIN pada `/login`, dan PRD Bab 6.H menyebut Staff
 * login via PIN operator. Desain yang dipakai di sini:
 *
 * - PIN BUKAN kata sandi Firebase. Menjadikannya kata sandi berarti PIN 6 digit
 *   harus tahan brute-force terhadap Firebase, yang tidak realistis.
 * - Form meminta email + PIN (bukan PIN saja). PIN saja ambigu lintas tenant dan
 *   tidak bisa diatribusikan ke akun mana pun, sehingga tidak ada yang bisa
 *   diaudit dan rate limit per akun tidak mungkin.
 * - Server mencari user STAFF aktif berdasarkan email, lalu mencocokkan PIN
 *   terhadap `booths.operator_pin_hash` milik tenant user tersebut. PIN tenant
 *   lain tidak berlaku.
 * - Sesi yang diterbitkan identik dengan jalur kata sandi (cookie yang sama,
 *   otorisasi DB yang sama). Tidak ada jalur otorisasi kedua yang lebih lemah.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  AuthorizationError,
  authorizeResolvedUser,
  findActiveStaffByEmail,
  tenantHasMatchingOperatorPin,
  touchLastLogin,
} from '@/lib/auth/authorization';
import { verifyPin } from '@/lib/auth/pin';
import {
  checkAuthEmailRateLimit,
  checkAuthRateLimit,
  authEmailRateLimitKey,
  authRateLimitKey,
} from '@/lib/auth/rate-limit';
import { safeHomeForRole } from '@/lib/auth/route-policy';
import { createSession, sessionCookieOptions } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Email + PIN 6 digit. Panjang PIN dibatasi sebelum menyentuh KDF. */
const staffPinRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  pin: z.string().regex(/^\d{6}$/),
});

/**
 * Pesan tunggal untuk SEMUA kegagalan PIN.
 *
 * Email tidak terdaftar, bukan STAFF, akun nonaktif, tenant diblokir,
 * langganan mati, dan PIN salah semuanya menghasilkan pesan ini. Membedakannya
 * akan mengubah endpoint menjadi alat enumerasi akun/tenant.
 */
const GENERIC_PIN_FAILURE = 'Email atau PIN tidak sesuai.';

export async function POST(request: Request) {
  const ipLimit = checkAuthRateLimit(authRateLimitKey(request, 'staff-pin'));
  if (!ipLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.',
        code: 'RATE_LIMITED',
      },
      { status: 429, headers: { 'cache-control': 'no-store' } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Permintaan tidak valid.', code: 'INVALID_BODY' },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }

  const parsed = staffPinRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: GENERIC_PIN_FAILURE, code: 'INVALID_INPUT' },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }

  const { email, pin } = parsed.data;

  // Batas kedua per email, setelah bentuk input terbukti sah.
  const emailLimit = checkAuthEmailRateLimit(authEmailRateLimitKey('staff-pin', email));
  if (!emailLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.',
        code: 'RATE_LIMITED',
      },
      { status: 429, headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    const user = await findActiveStaffByEmail(email);
    if (!user) {
      return failure();
    }

    // Otorisasi tenant + langganan SEBELUM verifikasi PIN: PIN yang benar pun
    // tidak boleh membuka tenant yang diblokir. Pemanggil sengaja TIDAK
    // memeriksa `tenantId` lebih dulu supaya semua keputusan tenant/langganan
    // tetap satu pintu di `authorizeResolvedUser`.
    const subscription = await authorizeResolvedUser(user);

    // `authorizeResolvedUser` sudah menolak tenant tanpa id, jadi di sini
    // `tenantId` dijamin terisi.
    const tenantId = user.tenantId;
    if (!tenantId) {
      return failure();
    }

    const pinMatches = await tenantHasMatchingOperatorPin(tenantId, pin, verifyPin);
    if (!pinMatches) {
      return failure();
    }

    const cookie = await createSession({
      userId: user.userId,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role,
      tenantId,
      parentTenantId: user.parentTenantId,
      subscription: subscription.gate,
      subscriptionStatus: subscription.status,
    });

    await touchLastLogin(user.userId);

    const response = NextResponse.json(
      { ok: true, role: user.role, redirectTo: safeHomeForRole(user.role) },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    );
    response.cookies.set(cookie.name, cookie.value, sessionCookieOptions(cookie.maxAge));

    return response;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return failure();
    }

    // Kegagalan infrastruktur (DB/KDF). Jangan bocorkan detail.
    return NextResponse.json(
      { ok: false, message: 'Login tidak dapat diproses saat ini.', code: 'INTERNAL' },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}

function failure() {
  return NextResponse.json(
    { ok: false, message: GENERIC_PIN_FAILURE, code: 'PIN_REJECTED' },
    { status: 401, headers: { 'cache-control': 'no-store' } },
  );
}

export function GET() {
  return NextResponse.json(
    { ok: false, message: 'Metode tidak didukung.' },
    { status: 405, headers: { allow: 'POST', 'cache-control': 'no-store' } },
  );
}
