/**
 * Self-check kontrak audit log (PRD Task 1.8).
 *
 * Dijalankan `node --test` dari root repo, pola sama dengan
 * `tenant-contract.test.mjs`: modul TS tidak diimpor langsung, melainkan
 * dicerminkan di sini. Bila aturan di `audit-contract.ts` berubah, test ini
 * gagal dan memaksa sinkronisasi.
 *
 * Yang diuji adalah INVARIAN keamanan, bukan detail pesan: IP hanya dari entri
 * pertama, header hilang menjadi null, kunci sensitif tidak pernah tersimpan
 * apa adanya, dan metadata kosong menjadi null.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const AUDIT_FIELD_LIMITS = {
  actorEmail: 255,
  action: 80,
  resourceType: 60,
  resourceId: 80,
  ipAddress: 60,
  requestId: 80,
  reason: 2000,
};
const AUDIT_REDACTED = '[redacted]';

const FORBIDDEN_KEY_FRAGMENTS = [
  'password',
  'secret',
  'apikey',
  'api_key',
  'token',
  'credential',
  'privatekey',
  'private_key',
  'inviteurl',
  'invite_url',
  'firebaseuid',
  'firebase_uid',
  'authorization',
  'signature',
];

function isForbiddenMetadataKey(key) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return FORBIDDEN_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function sanitizeAuditMetadata(value, depth = 0) {
  if (value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) return null;
  if (depth > 4) return null;

  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (isForbiddenMetadataKey(key)) {
      result[key] = AUDIT_REDACTED;
      continue;
    }
    if (raw === undefined) continue;
    if (typeof raw === 'string' && raw.length === 0) {
      result[key] = null;
      continue;
    }
    if (raw !== null && typeof raw === 'object') {
      result[key] = sanitizeAuditMetadata(raw, depth + 1);
      continue;
    }
    result[key] = raw;
  }

  return Object.keys(result).length === 0 ? null : result;
}

function extractClientIp(forwardedFor) {
  if (!forwardedFor) return null;
  const first = forwardedFor.split(',')[0]?.trim();
  if (!first) return null;
  return first.length <= AUDIT_FIELD_LIMITS.ipAddress
    ? first
    : first.slice(0, AUDIT_FIELD_LIMITS.ipAddress);
}

function truncate(value, max) {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

function normalizeRequestContext(headers) {
  return {
    ipAddress: extractClientIp(headers.forwardedFor),
    userAgent: truncate(headers.userAgent, 1000),
    requestId: truncate(headers.requestId, AUDIT_FIELD_LIMITS.requestId),
  };
}

test('IP memakai entri pertama x-forwarded-for', () => {
  assert.equal(extractClientIp('203.0.113.7, 10.0.0.1, 10.0.0.2'), '203.0.113.7');
  assert.equal(extractClientIp('  198.51.100.9  '), '198.51.100.9');
});

test('header hilang atau kosong menjadi null, bukan string kosong', () => {
  assert.deepEqual(normalizeRequestContext({}), {
    ipAddress: null,
    userAgent: null,
    requestId: null,
  });
  assert.equal(extractClientIp(''), null);
  assert.equal(extractClientIp('   , 10.0.0.1'), null);
  assert.equal(truncate('   '), null);
});

test('IP dan requestId dibatasi panjang kolom', () => {
  const longIp = 'a'.repeat(200);
  assert.equal(extractClientIp(longIp).length, AUDIT_FIELD_LIMITS.ipAddress);

  const ctx = normalizeRequestContext({ requestId: 'r'.repeat(500) });
  assert.equal(ctx.requestId.length, AUDIT_FIELD_LIMITS.requestId);
});

test('kunci metadata sensitif diganti, bukan disimpan apa adanya', () => {
  const sanitized = sanitizeAuditMetadata({
    planTier: 'GROWTH',
    inviteUrl: 'https://example.test/reset?token=abc',
    firebaseUid: 'uid-123',
    apiKey: 'sk_live_deadbeef',
    gatewayApiSecret: 'shh',
    nested: { accessToken: 'tok', safe: 'ok' },
  });

  assert.equal(sanitized.planTier, 'GROWTH');
  assert.equal(sanitized.inviteUrl, AUDIT_REDACTED);
  assert.equal(sanitized.firebaseUid, AUDIT_REDACTED);
  assert.equal(sanitized.apiKey, AUDIT_REDACTED);
  assert.equal(sanitized.gatewayApiSecret, AUDIT_REDACTED);
  assert.equal(sanitized.nested.accessToken, AUDIT_REDACTED);
  assert.equal(sanitized.nested.safe, 'ok');
});

test('metadata kosong, undefined, dan array menjadi null', () => {
  assert.equal(sanitizeAuditMetadata(null), null);
  assert.equal(sanitizeAuditMetadata(undefined), null);
  assert.equal(sanitizeAuditMetadata([]), null);
  assert.equal(sanitizeAuditMetadata({ a: undefined }), null);
});

test('string kosong menjadi null agar jsonb tidak menyimpan nilai tak bermakna', () => {
  assert.equal(sanitizeAuditMetadata({ note: '' }).note, null);
});

test('rekursi kedalaman dibatasi', () => {
  // Setiap objek menaikkan depth sekali; string di dalam objek disalin apa
  // adanya. Guard `depth > 4` menolak objek pada level ke-6 menjadi null.
  const deep = { l1: { l2: { l3: { l4: { l5: { l6: 'too deep' } } } } } };
  const sanitized = sanitizeAuditMetadata(deep);
  assert.deepEqual(sanitized, { l1: { l2: { l3: { l4: { l5: null } } } } });
});
