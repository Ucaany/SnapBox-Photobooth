/**
 * Self-check kontrak telemetry kesehatan + keamanan (PRD Task 1.11).
 *
 * Dijalankan `node --test` dari root repo, pola sama dengan test kontrak lain:
 * test TIDAK mengimpor modul TS agar bisa jalan dengan `node --test` polos.
 * Aturan di `health-security-contract.ts` dicerminkan di sini; bila salah satu
 * berubah, test ini gagal dan memaksa sinkronisasi.
 *
 * Fokus: INVARIAN trust boundary, yaitu redaksi detail sensitif, agregasi status
 * yang tidak boleh mengarang "sehat" ketika data kosong, dan klasifikasi sesi.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// ============ Cermin `safeDetail` ============

function safeDetail(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, item]) =>
        !/(token|secret|password|signature|payload|ip|email|authorization|credential)/i.test(key) &&
        (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'),
    ),
  );
}

test('safeDetail membuang kunci sensitif dan nilai non-skalar', () => {
  const result = safeDetail({
    reason: 'PIN_REJECTED',
    token: 'rahasia',
    apiSecret: 'rahasia',
    clientIp: '103.0.0.1',
    nested: { a: 1 },
    count: 3,
  });

  assert.deepEqual(result, { reason: 'PIN_REJECTED', count: 3 });
});

test('safeDetail mengembalikan objek kosong untuk input tidak valid', () => {
  assert.deepEqual(safeDetail(null), {});
  assert.deepEqual(safeDetail('string'), {});
  assert.deepEqual(safeDetail([1, 2]), {});
});

// ============ Cermin `aggregateHealthStatus` ============

function aggregateHealthStatus(rows) {
  if (rows.length === 0) return 'unavailable';
  if (rows.some((row) => row.status === 'outage')) return 'outage';
  if (rows.some((row) => row.status === 'degraded')) return 'degraded';
  if (rows.some((row) => row.status === 'unavailable')) return 'unavailable';
  return 'healthy';
}

test('agregasi: daftar kosong BUKAN healthy', () => {
  assert.equal(aggregateHealthStatus([]), 'unavailable');
});

test('agregasi: prioritas outage > degraded > unavailable > healthy', () => {
  assert.equal(
    aggregateHealthStatus([{ status: 'healthy' }, { status: 'degraded' }, { status: 'outage' }]),
    'outage',
  );
  assert.equal(
    aggregateHealthStatus([{ status: 'healthy' }, { status: 'unavailable' }]),
    'unavailable',
  );
  assert.equal(aggregateHealthStatus([{ status: 'healthy' }, { status: 'healthy' }]), 'healthy');
});

// ============ Cermin `classifyAuthSession` ============

function classifyAuthSession(revokedAt, expiresAt, nowMs) {
  if (revokedAt) return 'Dicabut';
  if (expiresAt.getTime() <= nowMs) return 'Kedaluwarsa';
  return 'Aktif';
}

test('klasifikasi sesi menghormati revoked dan kedaluwarsa', () => {
  const now = Date.UTC(2026, 8, 25);
  const future = new Date(now + 60_000);
  const past = new Date(now - 60_000);

  assert.equal(classifyAuthSession(null, future, now), 'Aktif');
  assert.equal(classifyAuthSession(null, past, now), 'Kedaluwarsa');
  assert.equal(classifyAuthSession(new Date(now), future, now), 'Dicabut');
});

// ============ Cermin `limitText` ============

function limitText(value, max) {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

test('limitText memotong, memangkas, dan menolak nilai kosong', () => {
  assert.equal(limitText('  abc  ', 10), 'abc');
  assert.equal(limitText('abcdef', 3), 'abc');
  assert.equal(limitText('   ', 5), null);
  assert.equal(limitText(null, 5), null);
});

// ============ Cermin `summarizeUserAgent` ============

function summarizeUserAgent(userAgent) {
  const limited = limitText(userAgent, 200);
  if (!limited) return null;
  return limited.replace(/\s+/g, ' ');
}

test('summarizeUserAgent merapikan spasi dan memotong panjang', () => {
  assert.equal(summarizeUserAgent('  Mozilla  5.0  '), 'Mozilla 5.0');
  assert.equal(summarizeUserAgent(null), null);
  assert.equal(summarizeUserAgent('a'.repeat(300)).length, 200);
});

// ============ Cermin `hashSubject` ============

async function hashSubject(value, salt) {
  // `globalThis` dipakai eksplisit karena lint test `.mjs` tidak mengenal
  // `TextEncoder`/`crypto` sebagai global Node.
  const encoder = new globalThis.TextEncoder();
  const data = encoder.encode(`${salt ?? ''}|${value.trim().toLowerCase()}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

test('hashSubject deterministik, case-insensitive, dan beda salt beda hash', async () => {
  const a = await hashSubject('Owner@Contoh.ID', 'salt-1');
  const b = await hashSubject('owner@contoh.id', 'salt-1');
  const c = await hashSubject('owner@contoh.id', 'salt-2');

  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('hashSubject tidak pernah mengembalikan nilai mentah', async () => {
  const value = '103.0.0.1';
  const hashed = await hashSubject(value, 'salt');
  assert.ok(!hashed.includes(value));
});
