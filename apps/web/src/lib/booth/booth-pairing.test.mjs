/**
 * Kontrak pairing booth (P-B-30 / P-B-31 / P-B-33) dan heartbeat (P-B-32).
 *
 * Yang diuji di sini: (a) fungsi murni yang bisa dijalankan tanpa DB, dan (b)
 * bentuk yang HARUS ada di route. Yang tidak bisa diuji di sini — atomisitas SQL
 * dan penolakan kode benar-benar — dijalankan terhadap database nyata oleh
 * `pnpm verify:security`, karena yang perlu dibuktikan adalah perilaku Postgres,
 * bukan teks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { createHash, randomBytes } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.join(here, relative), 'utf8');

process.env.DEVICE_JWT_SECRET ??= randomBytes(32).toString('base64url');

const { PAIRING_MAX_ATTEMPTS, PAIRING_TTL_MS, hashPairingCode, newPairingCode } =
  await import('./pairing-token.ts');
const { DEVICE_SESSION_TTL_DAYS, hashDeviceToken, issueDeviceToken } =
  await import('./device-token.ts');
const { HEARTBEAT_OFFLINE_SECONDS, deriveDisplayStatus } =
  await import('../owner-dashboard/machine-contract.ts');

const pairRoute = read('../../app/api/booth/pair/route.ts');
const heartbeatRoute = read('../../app/api/booth/heartbeat/route.ts');

test('hash pairing stabil dan hanya menyimpan hex, tidak pernah kode mentah', () => {
  const code = newPairingCode();
  const hash = hashPairingCode(code);

  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, createHash('sha256').update(code).digest('hex'));
  assert.notEqual(hash, code);
  assert.ok(!code.includes(hash));
  // Hash yang sama harus datang dari kode yang sama di kedua sisi rantai.
  const sessionModule = read(
    '../../app/(owner-dashboard)/owner-dashboard/machines/pairing-session.ts',
  );
  assert.ok(
    !/function hashPairingCode/.test(sessionModule),
    'definisi hash harus hidup hanya di pairing-token.ts',
  );
  assert.match(sessionModule, /hashPairingCode/);
  assert.match(pairRoute, /hashPairingCode/);
});

test('kode pairing punya entropi 144 bit dan berumur 10 menit', () => {
  const code = newPairingCode();
  // 18 byte acak → ±24 karakter base64url.
  assert.ok(code.length >= 22 && code.length <= 26, `panjang kode: ${code.length}`);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.equal(PAIRING_TTL_MS, 10 * 60 * 1000);
  assert.equal(new Set(Array.from({ length: 50 }, newPairingCode)).size, 50, 'kode harus unik');
});

test('ambang percobaan dikunci di satu tempat', () => {
  assert.equal(PAIRING_MAX_ATTEMPTS, 5);
  assert.ok(
    !/const PAIRING_MAX_ATTEMPTS = \d/.test(pairRoute),
    'route tidak boleh mendefinisikan ulang',
  );
  assert.ok(!/const PAIRING_MAX_ATTEMPTS = \d/.test(heartbeatRoute));
  // Both the claim and the failure counter must reference the shared constant.
  assert.match(pairRoute, /claimPairingToken\(tx, \{ codeHash, now \}\)/);
  assert.match(pairRoute, /recordFailedPairingAttempt\(tx, \{ codeHash, now \}\)/);
});

test('kode pairing tidak pernah disimpan plaintext, dan deviceQuota dihitung', async () => {
  assert.doesNotMatch(pairRoute, /insert\(pairingTokens\)[\s\S]{0,400}manualCode:\s*code\b/);
  // deviceQuota harus dipakai di dalam transaksi yang sama dengan insert devices.
  assert.match(pairRoute, /tenants\.deviceQuota/);
  assert.match(pairRoute, /tenant\.quota \+ tenant\.addOn/);
  assert.match(pairRoute, /insert\(devices\)/);
  // devices harus tersisip — inilah yang membuat deviceQuota dapat ditegakkan.
  assert.match(pairRoute, /sessionJwtHash: token\.tokenHash/);
});

test('route pairing menolak tenant/booth id dari body', () => {
  const bodySchema = pairRoute.slice(
    pairRoute.indexOf('const pairRequestSchema'),
    pairRoute.indexOf('const pairRequestSchema') + 600,
  );
  for (const forbidden of ['boothId', 'tenantId', 'userId', 'deviceId']) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\b`).test(bodySchema),
      `body pairing tidak boleh menerima ${forbidden}`,
    );
  }
  assert.match(bodySchema, /code:/);
  assert.match(bodySchema, /fingerprint:/);
});

test('kredensial perangkat berumur 30 hari dan hanya hash-nya yang disimpan', () => {
  const a = issueDeviceToken(1_000_000);
  const b = issueDeviceToken(1_000_000);

  assert.equal(DEVICE_SESSION_TTL_DAYS, 30);
  assert.equal(
    new Date(a.expiresAt).getTime() - 1_000_000,
    30 * 24 * 60 * 60 * 1000,
    'umur token harus 30 hari',
  );
  assert.notEqual(a.token, b.token, 'dua token tidak boleh sama walau waktunya sama');
  assert.match(a.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'token harus bertanda tangan');
  assert.notEqual(a.tokenHash, a.token);
  assert.equal(a.tokenHash, hashDeviceToken(a.token));
  assert.match(a.tokenHash, /^[0-9a-f]{64}$/);
  assert.ok(!Buffer.from(a.token).toString('utf8').includes(a.tokenHash));
});

test('DEVICE_JWT_SECRET kosong tidak melumpuhkan diam-diam', () => {
  const saved = process.env.DEVICE_JWT_SECRET;
  process.env.DEVICE_JWT_SECRET = 'pendek';
  try {
    assert.throws(() => issueDeviceToken(), /DEVICE_JWT_SECRET/);
  } finally {
    process.env.DEVICE_JWT_SECRET = saved;
  }
});

test('ambang offline 90 detik dan status tidak pernah mengarang ONLINE', () => {
  const now = Date.parse('2026-09-27T10:00:00Z');

  assert.equal(HEARTBEAT_OFFLINE_SECONDS, 90);
  // Tanpa heartbeat, status tersimpan apa pun tidak boleh jadi ONLINE.
  assert.equal(deriveDisplayStatus('ONLINE', null, false, now), 'OFFLINE');
  assert.equal(deriveDisplayStatus('UNPAIRED', null, false, now), 'UNPAIRED');
  // Heartbeat basi = OFFLINE.
  assert.equal(
    deriveDisplayStatus('ONLINE', new Date(now - 91_000).toISOString(), false, now),
    'OFFLINE',
  );
  assert.equal(
    deriveDisplayStatus('ONLINE', new Date(now - 30_000).toISOString(), false, now),
    'ONLINE',
  );
  // MAINTENANCE mengalahkan heartbeat yang masih segar.
  assert.equal(
    deriveDisplayStatus('ONLINE', new Date(now - 1_000).toISOString(), true, now),
    'MAINTENANCE',
  );
});

test('heartbeat memverifikasi perangkat dan menurunkan booth yang diam', () => {
  assert.match(heartbeatRoute, /await authenticateDevice\(/);
  // boothId/tenantId hanya boleh datang dari authenticateDevice.
  assert.match(heartbeatRoute, /boothId: device\.boothId/);
  assert.match(heartbeatRoute, /eq\(booths\.tenantId, device\.tenantId\)/);
  // Sweep offline tanpa cron: menyapu tenant sendiri.
  assert.match(heartbeatRoute, /await sweepStaleBooths\(device\.tenantId, now\)/);
  assert.match(heartbeatRoute, /eq\(booths\.status, 'ONLINE'\)/);
  assert.match(heartbeatRoute, /lt\(booths\.lastHeartbeatAt, cutoff\)/);
  assert.match(heartbeatRoute, /name: 'BOOTH_OFFLINE'/);
  assert.match(heartbeatRoute, /name: 'BOOTH_ONLINE'/);
  // Status yang ditetapkan Owner tidak boleh ditimpa heartbeat.
  assert.match(heartbeatRoute, /booth\.status === 'MAINTENANCE' \|\| booth\.status === 'UNPAIRED'/);
});

test('claim atomik hidup di satu fungsi dan dipakai route', () => {
  // `pairing-claim.ts` tidak bisa diimpor di sini: ia menyentuh skema Drizzle,
  // yang butuh loader. Yang dikunci adalah BENTUK pernyataan SQL-nya; atomisitas
  //nya dibuktikan terhadap Postgres nyata oleh `pnpm verify:security`.
  const source = read('./pairing-claim.ts');
  const claimBody = source.slice(
    source.indexOf('export async function claimPairingToken'),
    source.indexOf('export async function recordFailedPairingAttempt'),
  );

  // Satu pernyataan UPDATE dengan RETURNING: validasi dan konsumsi bersamaan.
  assert.equal((claimBody.match(/\.update\(pairingTokens\)/g) ?? []).length, 1);
  assert.match(claimBody, /\.returning\(/);
  for (const predicate of [
    'eq(pairingTokens.codeHash, input.codeHash)',
    'eq(pairingTokens.used, false)',
    'gt(pairingTokens.expiresAt, input.now)',
    '${pairingTokens.attemptCount} < ${PAIRING_MAX_ATTEMPTS}',
  ]) {
    assert.ok(claimBody.includes(predicate), `predikat hilang: ${predicate}`);
  }
  // Tidak boleh ada SELECT sebelum UPDATE: itu read-then-write, dan dua
  // permintaan bersamaan akan dua-duanya "berhasil".
  assert.doesNotMatch(claimBody, /\.select\(/);
  // Satu kemunculan `claimPairingToken(` saja, yaitu deklarasinya: kalau ada
  // pemanggilan dari dalam dirinya sendiri, klaim bukan satu pernyataan lagi.
  assert.equal((claimBody.match(/claimPairingToken\(/g) ?? []).length, 1);

  // Kedua fungsi diekspor dari satu modul, dan route memakainya.
  assert.match(source, /export async function claimPairingToken/);
  assert.match(source, /export async function recordFailedPairingAttempt/);
  assert.match(pairRoute, /from '@\/lib\/booth\/pairing-claim'/);
});
