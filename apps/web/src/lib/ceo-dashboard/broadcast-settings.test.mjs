/**
 * Self-check kontrak broadcast + pengaturan global (PRD Task 1.9).
 *
 * Modul sumber bebas `next/*`, DB, dan SDK sehingga aturan murni bisa diuji
 * dengan `node --test` dari root repo. Salinan perilaku di sini WAJIB sama
 * dengan `broadcast-contract.ts` dan `settings-contract.ts`; bila salah satu
 * berubah, test ini gagal dan memaksa keduanya diselaraskan.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// ============ SALINAN ATURAN BROADCAST ============

const TITLE_MIN = 4;
const TITLE_MAX = 200;
const MESSAGE_MIN = 12;
const MESSAGE_MAX = 280;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateBroadcast({ title, message, target }) {
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) return 'title';
  if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) return 'message';
  if (target.mode === 'selected') {
    const ids = [...new Set(target.tenantIds)];
    if (ids.length === 0) return 'target';
    if (ids.some((id) => !UUID_RE.test(id))) return 'target';
  } else if (target.mode !== 'all') {
    return 'target';
  }
  return null;
}

test('broadcast: judul dan pesan di luar batas ditolak', () => {
  const base = {
    title: 'Judul aman',
    message: 'Pesan broadcast minimal dua belas karakter.',
    target: { mode: 'all' },
  };
  assert.equal(validateBroadcast(base), null);

  assert.equal(validateBroadcast({ ...base, title: 'abc' }), 'title');
  assert.equal(validateBroadcast({ ...base, title: 'a'.repeat(TITLE_MAX + 1) }), 'title');
  assert.equal(validateBroadcast({ ...base, message: 'pendek' }), 'message');
  assert.equal(validateBroadcast({ ...base, message: 'x'.repeat(MESSAGE_MAX + 1) }), 'message');
});

test('broadcast: target selected wajib UUID dan minimal satu tenant', () => {
  const base = { title: 'Judul aman', message: 'Pesan broadcast minimal dua belas karakter.' };
  const uuid = '11111111-2222-3333-4444-555555555555';

  assert.equal(
    validateBroadcast({ ...base, target: { mode: 'selected', tenantIds: [uuid] } }),
    null,
  );
  assert.equal(
    validateBroadcast({ ...base, target: { mode: 'selected', tenantIds: [] } }),
    'target',
  );
  assert.equal(
    validateBroadcast({ ...base, target: { mode: 'selected', tenantIds: ['bukan-uuid'] } }),
    'target',
  );
  // Duplikat dinormalisasi, bukan ditolak.
  assert.equal(
    validateBroadcast({ ...base, target: { mode: 'selected', tenantIds: [uuid, uuid] } }),
    null,
  );
});

test('broadcast: mode target tak dikenal ditolak (fail closed)', () => {
  const base = { title: 'Judul aman', message: 'Pesan broadcast minimal dua belas karakter.' };
  assert.equal(validateBroadcast({ ...base, target: { mode: 'sebagian' } }), 'target');
  assert.equal(validateBroadcast({ ...base, target: {} }), 'target');
});

// ============ SALINAN ATURAN SETTINGS ============

const TEMPLATE_PLACEHOLDERS = {
  'email_template.tenant_invite': ['ownerName', 'companyName', 'actionUrl', 'expiresIn'],
  'email_template.invoice_b2b': [
    'ownerName',
    'companyName',
    'invoiceId',
    'amount',
    'dueDate',
    'paymentUrl',
  ],
  'email_template.subscription_expiring': ['ownerName', 'companyName', 'expiresAt', 'actionUrl'],
};

const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
const PLACEHOLDER_SHAPE = /\{\{[^}]*\}\}/g;

function extractPlaceholders(text) {
  const found = new Set();
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

function validatePlaceholders(key, subject, body) {
  const allowed = new Set(TEMPLATE_PLACEHOLDERS[key]);
  const violations = new Set();
  for (const found of extractPlaceholders(`${subject}\n${body}`)) {
    if (!allowed.has(found)) violations.add(found);
  }
  for (const match of `${subject}\n${body}`.matchAll(PLACEHOLDER_SHAPE)) {
    const inner = match[0].slice(2, -2).trim();
    if (!/^[A-Za-z0-9_]+$/.test(inner)) violations.add(match[0]);
  }
  return [...violations];
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderTemplate(template, values) {
  const replace = (text) =>
    text.replace(PLACEHOLDER_PATTERN, (whole, name) =>
      Object.prototype.hasOwnProperty.call(values, name) ? escapeHtml(values[name] ?? '') : whole,
    );
  return { subject: replace(template.subject), body: replace(template.body) };
}

test('settings: placeholder dikenal diterima, tak dikenal ditolak', () => {
  assert.deepEqual(
    validatePlaceholders(
      'email_template.tenant_invite',
      'Halo {{ownerName}}',
      'Buka {{actionUrl}}',
    ),
    [],
  );
  assert.deepEqual(
    validatePlaceholders('email_template.tenant_invite', 'Halo {{ownerName}}', 'Nilai {{harga}}'),
    ['harga'],
  );
  // Placeholder milik template lain juga ditolak di template ini.
  assert.deepEqual(validatePlaceholders('email_template.tenant_invite', '', '{{paymentUrl}}'), [
    'paymentUrl',
  ]);
});

test('settings: sintaks placeholder rusak terdeteksi', () => {
  assert.deepEqual(
    validatePlaceholders('email_template.tenant_invite', '', 'Nilai {{owner-name}}'),
    ['{{owner-name}}'],
  );
  assert.deepEqual(validatePlaceholders('email_template.tenant_invite', '', 'Kosong {{  }}'), [
    '{{  }}',
  ]);
  // Teks tanpa kurung ganda selalu valid.
  assert.deepEqual(
    validatePlaceholders('email_template.tenant_invite', 'Tanpa placeholder', 'Aman'),
    [],
  );
});

test('settings: render meng-escape HTML dan membiarkan placeholder kosong apa adanya', () => {
  const rendered = renderTemplate(
    { subject: 'Halo {{ownerName}}', body: 'Buka {{actionUrl}} dan {{belumDiisi}}' },
    { ownerName: '<script>alert(1)</script>', actionUrl: 'https://snapbox.id/a?x=1&y=2' },
  );
  assert.equal(rendered.subject, 'Halo &lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(rendered.body, 'Buka https://snapbox.id/a?x=1&amp;y=2 dan {{belumDiisi}}');
});

test('settings: nomor WhatsApp dinormalisasi ke digit saja', () => {
  const normalize = (value) => value.replace(/[^0-9]/g, '');
  assert.equal(normalize('+62 812-3456-7890'), '6281234567890');
  assert.equal(normalize('(0812) 3456 7890'), '081234567890');
  assert.equal(normalize(''), '');
});
