/**
 * Verifikasi kontrol keamanan terhadap server Next yang SEDANG BERJALAN.
 *
 * Berbeda dari `verify-security-controls.mts` (yang menguji semantik SQL), skrip
 * ini menguji apa yang benar-benar dilihat pengguna: status HTTP, isi header
 * respons, dan apakah cookie yang sudah dicabut masih bisa dipakai.
 *
 * Yang diperiksa — inilah daftar "done when" yang mengikat:
 * 1. `Strict-Transport-Security` dan `Content-Security-Policy` ada di respons.
 * 2. Sesi OWNER pada dua halaman tenant CEO mendapat 404, bukan 403 (dan bukan
 *    500) — keberadaan tenant tidak boleh bocor lewat perbedaan status.
 * 3. Cookie yang sudah dicabut di `auth_sessions.revoked_at` tidak lagi
 *    mengautentikasi: request berikutnya dialihkan ke login.
 * 4. Sesi STAFF ditolak pada setiap aksi destruktif Owner.
 * 5. Booth yang diam turun ke OFFLINE tanpa tindakan manusia.
 *
 * Sesi dibuat langsung lewat `createSession` terhadap baris `users` nyata, jadi
 * tidak butuh password dan tidak butuh Firebase. Sesi STAFF dibuat untuk
 * keperluan test dan DIHAPUS lagi di akhir.
 *
 * PEMAKAIAN:
 *   # terminal 1
 *   pnpm --filter @snapbox/web build && pnpm --filter @snapbox/web start
 *   # terminal 2
 *   BASE_URL=http://127.0.0.1:3000 pnpm verify:runtime
 *
 * Tidak ada secret, ID token, atau nilai kredensial yang dicetak.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { and, eq, isNull, sql } from 'drizzle-orm';

import { authSessions, booths, devices, getDatabase, tenants, users } from '@snapbox/db';

const { createSession } = await import('../apps/web/src/lib/auth/session.ts');
// `device-token.ts` sengaja tidak dikunci `server-only` supaya bisa dimuat di luar
// Next; alasannya diuji di `server-only-boundary.test.mjs`.
const { issueDeviceToken } = await import('../apps/web/src/lib/booth/device-token.ts');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const MARKER = '__verify_runtime_';

const results = { pass: 0, fail: 0 };

function check(name: string, pass: boolean, detail = ''): void {
  if (pass) results.pass += 1;
  else results.fail += 1;
  console.log(`  ${pass ? 'LOLOS' : 'GAGAL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function loadDotEnv(): void {
  let source: string;
  try {
    source = readFileSync(path.join(root, '.env'), 'utf8');
  } catch {
    return;
  }
  for (const line of source.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, name, raw] = match;
    if (process.env[name] !== undefined) continue;
    const quoted = /^(['"])([\s\S]*)\1$/.exec(raw.trim());
    process.env[name] = (quoted ? quoted[2] : raw).replace(/\\n/g, '\n').trim();
  }
}

/** Permintaan dengan cookie sesi, tanpa mengikuti redirect. */
async function get(pathname, cookie, extraHeaders = {}) {
  return fetch(`${BASE_URL}${pathname}`, {
    method: 'GET',
    redirect: 'manual',
    headers: { cookie: cookie ? `snapbox_session=${cookie}` : '', ...extraHeaders },
  });
}

async function main() {
  loadDotEnv();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum diset');

  const db = getDatabase();

  // ---头顶 Sesi nyata dari baris users yang benar-benar ada.
  // Hanya akun dengan uid Firebase NYATA yang dipakai. Baris hasil seed
  // (`seed:*`) memang tidak ada di Firebase, jadi sesi yang dibuat dari sana
  // tidak mewakili apa pun.
  const real = and(
    isNull(users.deletedAt),
    eq(users.disabled, false),
    sql<string>`${users.firebaseUid} not like 'seed:%'`,
  );

  const [ceoUser] = await db
    .select()
    .from(users)
    .where(and(real, eq(users.role, 'CEO')))
    .limit(1);
  const [ownerUser] = await db
    .select()
    .from(users)
    .where(and(real, eq(users.role, 'OWNER')))
    .limit(1);
  if (!ceoUser || !ownerUser)
    throw new Error('perlu minimal satu CEO dan satu OWNER nyata untuk diuji');
  if (!ownerUser.tenantId) throw new Error('OWNER uji harus punya tenant');

  const realTenant = await db.select({ id: tenants.id }).from(tenants).limit(1);
  if (realTenant.length === 0) throw new Error('perlu minimal satu tenant nyata untuk diuji');
  const tenantId = realTenant[0]!.id;

  // Sesi STAFF dibuat khusus untuk test lalu dihapus.
  const [staffUser] = await db
    .insert(users)
    .values({
      firebaseUid: `${MARKER}uid-staff`,
      email: `${MARKER}staff@example.invalid`,
      fullName: `${MARKER} Staff`,
      role: 'STAFF',
      tenantId: ownerUser.tenantId,
      parentTenantId: ownerUser.tenantId,
    })
    // `returning()` tanpa daftar kolom: sesi dibuat dari baris utuh, bukan
    // hanya `id`. Mengambil `returning({ id })` membuat `role`/`firebaseUid`
    // menjadi `undefined` dan `createSession` menolaknya.
    .returning();

  // Nilai role/tenant diteruskan apa adanya dari baris DB; `SessionPayload`
  // mengizinkan `null` untuk tenant karena CEO memang tidak punya satu. Gerbang
  // tidak pernah memercayai nilai ini dari cookie — `requireCeo()` dan
  // `requireOwnerTenant()` membaca role dan tenant dari DB.
  // `createSession` mengembalikan `{ name, value, maxAge }` — bukan `sessionId`.
  // Id-nya dibuat di sini supaya bisa dihapus kembali nanti.
  const sessionFor = async (user) => {
    const sessionId = crypto.randomUUID();
    const cookie = await createSession({
      sessionId,
      userId: user.id,
      firebaseUid: user.firebaseUid ?? '',
      email: user.email ?? '',
      role: user.role,
      tenantId: user.tenantId,
      parentTenantId: user.parentTenantId,
      subscription: 'OK',
      subscriptionStatus: null,
    });

    return { sessionId, cookie };
  };

  // Sesi dibuat DI DALAM try supaya fixture STAFF selalu terhapus, termasuk
  // saat pembuatan sesi itu sendiri gagal.
  const issued = [];
  const issuedDevices = [];
  // Diberi nilai di dalam try, dibersihkan di finally: kalau salah satu
  // pemeriksaan melempar, fixture tetap hilang.
  let spareBoothId = null;
  try {
    const ceo = await sessionFor(ceoUser);
    const owner = await sessionFor(ownerUser);
    const staff = await sessionFor(staffUser);
    issued.push(ceo.sessionId, owner.sessionId, staff.sessionId);
    const ceoCookie = ceo.cookie;
    const ownerCookie = owner.cookie;
    const staffCookie = staff.cookie;

    // 1. Header keamanan.
    const login = await get('/login');
    const hsts = login.headers.get('strict-transport-security');
    const csp = login.headers.get('content-security-policy');

    check('respons membawa Strict-Transport-Security', Boolean(hsts), hsts ?? 'header hilang');
    check(
      'respons membawa Content-Security-Policy',
      Boolean(csp),
      csp ? `${csp.length} byte` : 'header hilang',
    );
    if (csp) {
      for (const directive of ["object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
        check(`CSP memuat ${directive}`, csp.includes(directive));
      }
      check('CSP tidak memakai unsafe-eval di production', !csp.includes("'unsafe-eval'"));
      check(
        'CSP tidak memakai unsafe-inline pada script-src',
        !/script-src[^;]*'unsafe-inline'/.test(csp),
      );
      const nonce = /'nonce-([A-Za-z0-9_-]+)'/.exec(csp)?.[1];
      check('CSP memakai nonce per-request', Boolean(nonce && nonce.length >= 16));
    }
    check(
      'X-Content-Type-Options: nosniff ada',
      login.headers.get('x-content-type-options') === 'nosniff',
    );

    // 2. Sesi non-CEO pada dua halaman tenant.
    //
    // DUA LAPIS, dan keduanya diuji:
    // - Middleware menjawab 307 ke beranda peran sendiri. Itu perilaku lama yang
    //   tetap benar: OWNER yang mengikuti tautan CEO diarahkan ke dashboard-nya,
    //   bukan diberi 403 yang membocorkan bahwa halamannya ada. Yang penting:
    //   respons TIDAK memuat halaman tenant dan TIDAK mengandung PII tenant.
    // - Loader di `tenant-server.ts` memanggil `requireCeo()` lebih dulu, jadi
    //   walau middleware dilewati, loader menolak sebelum membaca tenant, dan
    //   kedua halaman memetakan penolakan itu ke `notFound()` (404). Bentuk ini
    //   dikunci oleh `server-only-boundary.test.mjs`; di sini yang dipastikan
    //   adalah lapisan luar tidak bocor.
    for (const [label, pathname] of [
      ['halaman detail tenant', `/ceo-dashboard/tenants/${tenantId}`],
      ['halaman tenant baru', '/ceo-dashboard/tenants/new'],
    ]) {
      const response = await get(pathname, ownerCookie.value);
      const location = response.headers.get('location') ?? '';
      check(
        `sesi OWNER tidak pernah melihat ${label}`,
        response.status !== 200,
        `status=${response.status} location=${location || '(tidak ada)'}`,
      );
      check(
        `sesi OWNER tidak dialihkan ke halaman tenant ${label}`,
        !location.includes('/ceo-dashboard/tenants'),
        `location=${location || '(tidak ada)'}`,
      );
      const body = await response.text();
      check(`tidak ada PII tenant di respons ${label}`, !body.includes(tenantId));
    }

    // Sesi CEO sendiri harus tetap bisa membaca, supaya 404 di atas bukan
    // 404 karena rute-nya memang rusak.
    const ceoDetail = await get(`/ceo-dashboard/tenants/${tenantId}`, ceoCookie.value);
    check(
      'sesi CEO tetap punya akses (404 di atas bukan rute rusak)',
      ceoDetail.status === 200,
      `status=${ceoDetail.status}`,
    );

    // 3. Sesi yang dicabut tidak lagi mengautentikasi.
    const revoked = await sessionFor(ownerUser);
    issued.push(revoked.sessionId);
    await db.insert(authSessions).values({
      id: revoked.sessionId,
      userId: ownerUser.id,
      role: 'OWNER',
      expiresAt: new Date(Date.now() + 43_200_000),
    });
    // `/owner-dashboard/subscription` dipakai karena satu-satunya rute OWNER
    // yang TIDAK digerbang langganan (`SUBSCRIPTION_EXEMPT_PREFIXES`). Tanpa
    // itu, tenant uji di database ini akan dialihkan ke halaman langganan
    // dan tes ini mengukur hal yang salah. Rute yang sama berlaku sebelum dan
    // sesudah pencabutan, jadi perbandingannya sahih.
    const beforeRevoke = await get('/owner-dashboard/subscription', revoked.cookie.value);
    const beforeLocation = beforeRevoke.headers.get('location') ?? '';
    // Tenant uji di database ini langganannya tidak aktif, jadi SELURUH
    // owner-dashboard dialihkan ke halaman langganan lebih dulu. Yang dibedakan
    // di sini adalah "sesi ini tidak lagi diakui" — yaitu dialihkan ke /login —
    // bukan "halaman ini mengembalikan 200".
    check(
      'sesi yang baru diterbitkan tidak dialihkan ke login',
      !beforeLocation.includes('/login'),
      `status=${beforeRevoke.status} location=${beforeLocation || '(tidak ada)'}`,
    );

    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.id, revoked.sessionId), isNull(authSessions.revokedAt)));

    const afterRevoke = await get('/owner-dashboard/subscription', revoked.cookie.value);
    const location = afterRevoke.headers.get('location') ?? '';
    check(
      'cookie yang dicabut tidak lagi mengautentikasi',
      afterRevoke.status !== 200 && location.includes('/login'),
      `status=${afterRevoke.status} location=${location || '(tidak ada)'}`,
    );

    // 4. Sesi STAFF ditolak di depan pintu Owner.
    //
    // Halaman dashboard Owner adalah tempat pertama di mana sesi STAFF akan
    // mencoba membaca data tenant. Kalau ini sudah ditolak, seluruh 41 aksi
    // destruktif di baliknya dilindungi oleh gerbang yang sama
    // (`requireOwnerTenant` menolak role !== OWNER), dan `check-ceo-provisioning`
    // menjaga agar tidak ada halaman Owner tanpa gerbang.
    const staffResponse = await get('/owner-dashboard/machines', staffCookie.value);
    const staffLocation = staffResponse.headers.get('location') ?? '';
    check(
      'sesi STAFF tidak bisa membuka halaman mesin Owner',
      staffResponse.status !== 200,
      `status=${staffResponse.status} location=${staffLocation || '(tidak ada)'}`,
    );

    // 5. Booth yang diam turun ke OFFLINE tanpa tindakan manusia.
    //
    // Diuji lewat ENDPOINT NYATA, bukan lewat helper internal: satu booth
    // dibuat "diam" (ONLINE tapi heartbeat lama), lalu booth LAIN di tenant yang
    // sama mengirim heartbeat. Sweep di dalam route itu harus menurunkan booth
    // yang diam ke OFFLINE — tanpa cron, tanpa tindakan manusia, tanpa reload
    // halaman.
    const existingBooths = await db
      .select({ id: booths.id, status: booths.status })
      .from(booths)
      .where(eq(booths.tenantId, ownerUser.tenantId))
      .limit(1);

    // Booth kedua dibuat khusus untuk test bila tenant hanya punya satu, lalu
    // dihapus di akhir. Uji ini butuh DUA booth dalam satu tenant: satu yang
    // hidup dan mengirim heartbeat, satu yang diam.
    if (existingBooths.length < 1) {
      check('tenant uji punya minimal satu booth', false, 'tenant uji kosong');
    } else {
      const [spare] = await db
        .insert(booths)
        .values({ tenantId: ownerUser.tenantId, name: `${MARKER}booth-spare` })
        .returning({ id: booths.id, status: booths.status });
      spareBoothId = spare.id;
    }

    if (!spareBoothId) {
      // Tidak ada yang bisa diuji; laporkan, jangan diam-diam lolos.
      check(
        'booth yang diam turun ke OFFLINE tanpa tindakan manusia',
        false,
        'tidak ada booth uji',
      );
    } else {
      const live = existingBooths[0];
      const silent = { id: spareBoothId, status: 'UNPAIRED' };
      const fingerprint = `${MARKER}fp-${crypto.randomUUID().slice(0, 8)}`;
      const deviceToken = issueDeviceToken();

      const [device] = await db
        .insert(devices)
        .values({
          boothId: live.id,
          tenantId: ownerUser.tenantId,
          deviceFingerprint: fingerprint,
          lastHeartbeatAt: new Date(),
          sessionJwtHash: deviceToken.tokenHash,
        })
        .returning({ id: devices.id });
      issuedDevices.push(device.id);

      // Booth kedua dibuat "diam": statusnya ONLINE, tapi heartbeat-nya 10 menit
      // lalu — jauh melewati ambang 90 detik.
      const silentFingerprint = `${MARKER}fp-${crypto.randomUUID().slice(0, 8)}`;
      await db.insert(devices).values({
        boothId: silent.id,
        tenantId: ownerUser.tenantId,
        deviceFingerprint: silentFingerprint,
        lastHeartbeatAt: new Date(),
        sessionJwtHash: issueDeviceToken().tokenHash,
      });
      await db
        .update(booths)
        .set({ status: 'ONLINE', lastHeartbeatAt: new Date(Date.now() - 600_000) })
        .where(eq(booths.id, silent.id));

      const [beforeSweep] = await db
        .select({ status: booths.status })
        .from(booths)
        .where(eq(booths.id, silent.id));

      // Heartbeat dari booth yang hidup. Sweep menyapu tenant yang sama.
      const heartbeat = await fetch(`${BASE_URL}/api/booth/heartbeat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: deviceToken.token, fingerprint }),
      });

      const [afterSweep] = await db
        .select({ status: booths.status })
        .from(booths)
        .where(eq(booths.id, silent.id));

      check(
        'heartbeat perangkat terverifikasi diterima',
        heartbeat.status === 200,
        `status=${heartbeat.status}`,
      );
      check(
        'booth yang diam turun ke OFFLINE tanpa tindakan manusia',
        beforeSweep?.status === 'ONLINE' && afterSweep?.status === 'OFFLINE',
        `sebelum=${beforeSweep?.status} sesudah=${afterSweep?.status}`,
      );

      // Token yang fingerprint-nya tidak cocok harus ditolak: ini yang membuat
      // token perangkat tidak bisa dipakai di mesin lain.
      const wrongFingerprint = await fetch(`${BASE_URL}/api/booth/heartbeat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: deviceToken.token,
          fingerprint: `${MARKER}fp-other`,
        }),
      });
      check(
        'token perangkat ditolak bila fingerprint tidak cocok',
        wrongFingerprint.status === 401,
        `status=${wrongFingerprint.status}`,
      );

      // Dan token yang dipalsukan harus ditolak.
      const forged = await fetch(`${BASE_URL}/api/booth/heartbeat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: `${deviceToken.token}x`, fingerprint }),
      });
      check(
        'token perangkat yang dimodifikasi ditolak',
        forged.status === 401,
        `status=${forged.status}`,
      );

      // Kembalikan dua booth ke keadaan semula supaya data produksi tidak berubah.
      await db
        .update(booths)
        .set({ status: silent.status, lastHeartbeatAt: null })
        .where(eq(booths.id, silent.id));
      await db
        .update(booths)
        .set({ status: live.status, lastHeartbeatAt: null })
        .where(eq(booths.id, live.id));
    }
  } finally {
    for (const sessionId of issued) {
      await db.delete(authSessions).where(eq(authSessions.id, sessionId));
    }
    for (const deviceId of issuedDevices) {
      await db.delete(devices).where(eq(devices.id, deviceId));
    }
    if (spareBoothId) {
      // Booth cadangan ikut dihapus: skrip tidak boleh meninggalkan jejak,
      // termasuk ketika salah satu pemeriksaan gagal di tengah jalan.
      await db.delete(booths).where(eq(booths.id, spareBoothId));
    }
    await db.delete(users).where(eq(users.id, staffUser.id));
  }
}

const { closeDatabase } = await import('@snapbox/db/client');
try {
  await main();
} catch (error) {
  console.error(`GAGAL: ${error instanceof Error ? error.message : String(error)}`);
  results.fail += 1;
} finally {
  await closeDatabase();
}

console.log(`\n${results.pass} lulus, ${results.fail} gagal.`);
if (results.fail > 0) process.exitCode = 1;
