/**
 * Rotasi kunci cookie sesi (P-B-02) dan atribut `Secure` (P-B-03).
 *
 * Self-check yang MENJALANKAN modul produksi `session.ts`, bukan salinannya:
 * bug rotasi ini hanya hidup di interaksi antara cache kunci, pemisahan `kid`,
 * dan pemilihan kandidat kunci, jadi menyalin logikanya ke test tidak
 * membuktikan apa pun. `node --test` memuat `.ts` lewat type-stripping bawaan
 * Node, dan `session.ts` sengaja hanya memakai Web Crypto agar tidak butuh
 * loader lain.
 *
 * Setiap skenario memuat ulang modul lewat query string agar cache kunci di
 * dalam modul ikut ter-reset — persis seperti restart proses, dan itulah kondisi nyata saat deploy bergulir.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHmac, randomBytes } from 'node:crypto';
import process from 'node:process';

const SECRET_A = randomBytes(32).toString('base64');
const SECRET_B = randomBytes(32).toString('base64');
const SECRET_C = randomBytes(32).toString('base64');

/** Muat ulang modul dengan env tertentu; cache kunci ikut ter-reset. */
async function loadSession(env) {
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  return import(`./session.ts?instance=${Math.random()}`);
}

const base = {
  SESSION_COOKIE_SECRET: SECRET_A,
  SESSION_COOKIE_SECRET_PREVIOUS: '',
  SESSION_COOKIE_INSECURE_DEV: '',
};

const input = {
  userId: '11111111-1111-4111-8111-111111111111',
  firebaseUid: 'uid-1',
  email: 'ceo@example.com',
  role: 'CEO',
  tenantId: null,
  parentTenantId: null,
  subscription: 'OK',
  subscriptionStatus: null,
};

test('cookie memakai bentuk kid.payload.signature', async () => {
  const { createSession } = await loadSession(base);
  const cookie = await createSession(input);
  const parts = cookie.value.split('.');

  assert.equal(parts.length, 3, 'harus ada prefix kid');
  assert.match(parts[0], /^[A-Za-z0-9_-]{8}$/, 'kid adalah 8 karakter base64url');
  assert.equal(cookie.name, 'snapbox_session');
  assert.equal(cookie.maxAge, 43200);
});

test('jendela tumpang tindih: satu instance menerima cookie dari kedua kunci', async () => {
  const before = await loadSession(base);
  const cookieFromA = await before.createSession(input);

  // Instance baru memegang kunci B dan masih menerima kunci A. Inilah kondisi
  // yang membuat deploy bergulir tidakinnyentrubuhkan siapa pun: cookie lama
  // yang ditandatangani A masih dibaca, cookie baru ditandatangani B.
  const after = await loadSession({
    ...base,
    SESSION_COOKIE_SECRET: SECRET_B,
    SESSION_COOKIE_SECRET_PREVIOUS: SECRET_A,
  });
  const cookieFromB = await after.createSession(input);

  const verifiedOld = await after.verifySession(cookieFromA.value);
  assert.ok(verifiedOld, 'cookie dari kunci lama harus tetap sah saat overlap');
  assert.equal(verifiedOld.userId, input.userId);

  const verifiedNew = await after.verifySession(cookieFromB.value);
  assert.ok(verifiedNew, 'cookie dari kunci baru harus sah di instance yang sama');
  assert.equal(verifiedNew.userId, input.userId);

  // Dan ini alasan prosedur rotasi memakai dua langkah: instance yang HANYA
  // tahu kunci A tidak bisa membaca cookie bertanda B, jadi kunci lama tidak
  // boleh dicabut di langkah yang sama saat kunci baru dipasang.
  const onlyA = await loadSession(base);
  assert.equal(await onlyA.verifySession(cookieFromB.value), null);
});

test('pensiun kunci: setelah kunci lama ditarik, cookie lamanya ditolak', async () => {
  const before = await loadSession({ ...base, SESSION_COOKIE_SECRET: SECRET_B });
  const cookie = await before.createSession(input);

  const retired = await loadSession({ ...base, SESSION_COOKIE_SECRET: SECRET_C });
  assert.equal(await retired.verifySession(cookie.value), null, 'kid tak dikenal harus ditolak');
});

test('kid ikut ditandatangani: menukar kid tidak mengubah hasil verifikasi', async () => {
  const signer = await loadSession(base);
  const cookie = await signer.createSession(input);
  const [kid, body, signature] = cookie.value.split('.');

  const { verifySession } = await loadSession({
    ...base,
    SESSION_COOKIE_SECRET: SECRET_B,
    SESSION_COOKIE_SECRET_PREVIOUS: SECRET_A,
  });

  const otherKid = kid === 'aaaaaaaa' ? 'bbbbbbbb' : 'aaaaaaaa';
  assert.equal(await verifySession(`${otherKid}.${body}.${signature}`), null);
  assert.equal((await verifySession(cookie.value)) !== null, true);
});

test('bentuk lama tanpa kid masih dibaca, lalu mati setelah rotasi', async () => {
  const signer = await loadSession(base);
  const cookie = await signer.createSession(input);
  const body = cookie.value.split('.')[1];

  // Bentuk legacy `payload.signature`: tanda tangan dihitung atas body saja.
  const legacySignature = createHmac('sha256', Buffer.from(SECRET_A, 'base64'))
    .update(body)
    .digest('base64url');
  const legacyCookie = `${body}.${legacySignature}`;

  const { verifySession: verifyLegacy } = await loadSession(base);
  assert.ok(await verifyLegacy(legacyCookie), 'cookie lama harus tetap bisa dibaca');

  const rotated = await loadSession({
    ...base,
    SESSION_COOKIE_SECRET: SECRET_B,
    SESSION_COOKIE_SECRET_PREVIOUS: SECRET_A,
  });
  assert.ok(await rotated.verifySession(legacyCookie), 'legacy tetap sah saat overlap');

  const retired = await loadSession({ ...base, SESSION_COOKIE_SECRET: SECRET_C });
  assert.equal(await retired.verifySession(legacyCookie), null, 'legacy mati setelah rotasi');
});

test('cookie kedaluwarsa, rusak, dan salah tanda tangan ditolak', async () => {
  const { createSession, verifySession, SESSION_MAX_AGE_SECONDS } = await loadSession(base);
  const cookie = await createSession(input);
  const [kid, body, signature] = cookie.value.split('.');

  const tampered = `${body.slice(0, -2)}AA.${signature}`;
  assert.equal(await verifySession(tampered), null);
  assert.equal(await verifySession(`${kid}.${body}.${signature}extra`), null);
  assert.equal(await verifySession(`${kid}.${body}`), null);
  assert.equal(await verifySession(''), null);
  assert.equal(await verifySession(null), null);

  const expired = await createSession(input, Date.now() - (SESSION_MAX_AGE_SECONDS + 60) * 1000);
  assert.equal(await verifySession(expired.value), null);
});

test('Secure aktif di setiap runtime kecuali opt-out eksplisit', async () => {
  // Default: aktif, apa pun nilai NODE_ENV.
  for (const nodeEnv of ['production', 'development', 'test', undefined]) {
    const { sessionCookieOptions } = await loadSession({ ...base, NODE_ENV: nodeEnv });
    assert.equal(
      sessionCookieOptions(60).secure,
      true,
      `Secure harus aktif dengan NODE_ENV=${String(nodeEnv)}`,
    );
  }

  const optedOut = await loadSession({ ...base, SESSION_COOKIE_INSECURE_DEV: '1' });
  assert.equal(optedOut.sessionCookieOptions(60).secure, false);

  const typo = await loadSession({ ...base, SESSION_COOKIE_INSECURE_DEV: 'true' });
  assert.equal(typo.sessionCookieOptions(60).secure, true, 'hanya nilai "1" yang menonaktifkan');
});

test('atribut cookie lain tidak melemah saat Secure dimatikan', async () => {
  const { sessionCookieOptions } = await loadSession({ ...base, SESSION_COOKIE_INSECURE_DEV: '1' });
  const options = sessionCookieOptions(600);
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.path, '/');
  assert.equal(options.maxAge, 600);
});
