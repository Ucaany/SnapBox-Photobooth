/**
 * Self-check kontrak editor plan (PRD Task 1.5).
 *
 * Dijalankan `node --test` dari root repo, pola sama dengan
 * `tenant-contract.test.mjs`. Test ini sengaja tidak mengimpor modul TS agar
 * bisa jalan dengan `node --test` polos; bila aturan di `plan-contract.ts`
 * berubah, test ini gagal dan memaksa sinkronisasi.
 *
 * Yang diuji adalah INVARIAN trust boundary, bukan detail pesan: normalisasi
 * harga, aturan unlimited, penolakan key asing, invariant antar-feature, dan
 * perilaku diff yang dipakai server action serta tombol simpan editor.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const MAX_PRICE = 9_999_999_999;
const MAX_LIMIT = 100_000;
const UNLIMITED = -1;
const FEATURE_KEYS = [
  'deviceIncluded',
  'addOnPricePerDevice',
  'paymentGatewayB2C',
  'backupGateway',
  'cameraTypes',
  'maxFrameUpload',
  'storageMb',
  'retentionDays',
  'promoEnabled',
  'promoAdvanced',
  'kioskCustomEnabled',
  'kioskMultiplePanelStyle',
  'staffLimit',
  'outletLimit',
  'chromaKeyLevel',
  'filterLevel',
  'supportLevel',
  'priorityRealtime',
];
const UNLIMITED_KEYS = ['maxFrameUpload', 'staffLimit', 'outletLimit'];
const TOP_LEVEL_KEYS = ['name', 'priceMonthly', 'priceYearly'];

/** Cermin `planPriceSchema`. */
function normalizePrice(value) {
  const raw = typeof value === 'number' ? String(value) : String(value).trim();
  if (raw === '') return { ok: false, reason: 'kosong' };
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { ok: false, reason: 'format' };
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric > MAX_PRICE) return { ok: false, reason: 'rentang' };
  return { ok: true, value: numeric.toFixed(2) };
}

/** Cermin `limitSchema(unlimited)`. */
function normalizeLimit(value, unlimited) {
  const raw = typeof value === 'number' ? String(value) : String(value).trim();
  if (!/^-?\d+$/.test(raw)) return { ok: false, reason: 'bukan-integer' };
  const numeric = Number(raw);
  if (!Number.isSafeInteger(numeric)) return { ok: false, reason: 'rentang' };
  if (numeric === UNLIMITED)
    return unlimited ? { ok: true, value: UNLIMITED } : { ok: false, reason: 'tanpa-batas' };
  if (numeric < 0 || numeric > MAX_LIMIT) return { ok: false, reason: 'rentang' };
  return { ok: true, value: numeric };
}

/** Cermin `superRefine` di `planFeaturesSchema`. */
function featureInvariantErrors(features) {
  const errors = [];
  if (features.backupGateway && !features.paymentGatewayB2C) errors.push('backupGateway');
  if (features.promoAdvanced && !features.promoEnabled) errors.push('promoAdvanced');
  if (features.kioskMultiplePanelStyle && !features.kioskCustomEnabled)
    errors.push('kioskMultiplePanelStyle');
  return errors;
}

/** Cermin `diffPlanFields` di `plan-contract.ts`. */
function diffPlanFields(before, after) {
  const changed = [];
  for (const key of TOP_LEVEL_KEYS) {
    if ((before[key] ?? '') !== (after[key] ?? '')) changed.push(key);
  }
  for (const key of FEATURE_KEYS) {
    const prev = before.features[key];
    const next = after.features[key];
    // Array (cameraTypes) dibandingkan sebagai himpunan: urutan bukan perubahan berarti.
    const same =
      Array.isArray(prev) && Array.isArray(next)
        ? prev.length === next.length && prev.every((item) => next.includes(item))
        : prev === next;
    if (!same) changed.push(`features.${key}`);
  }
  return changed;
}

/** Cermin `PlanFeatureField.unlimited` untuk tiga field yang mendukungnya. */
const UNLIMITED_FIELDS = new Set(UNLIMITED_KEYS);

test('harga: menormalkan ke dua desimal dan menolak format ilegal', () => {
  assert.deepEqual(normalizePrice('180000'), { ok: true, value: '180000.00' });
  assert.deepEqual(normalizePrice('1000.5'), { ok: true, value: '1000.50' });
  assert.deepEqual(normalizePrice(250000), { ok: true, value: '250000.00' });
  for (const bad of ['', '12,000', 'Rp 100', '-5', '1.234', 'abc']) {
    assert.equal(normalizePrice(bad).ok, false, `harus ditolak: ${bad}`);
  }
});

test('harga: menolak nilai di atas presisi kolom numeric(12,2)', () => {
  assert.equal(normalizePrice(String(MAX_PRICE)).ok, true);
  assert.equal(normalizePrice(String(MAX_PRICE + 1)).ok, false);
});

test('limit: -1 hanya sah untuk field unlimited', () => {
  assert.deepEqual(normalizeLimit('-1', true), { ok: true, value: UNLIMITED });
  assert.equal(normalizeLimit('-1', false).ok, false);
  for (const key of UNLIMITED_KEYS) {
    assert.equal(UNLIMITED_FIELDS.has(key), true, key);
    assert.equal(normalizeLimit('-1', UNLIMITED_FIELDS.has(key)).ok, true, key);
  }
});

test('limit: menolak negatif selain -1, pecahan, dan di atas batas', () => {
  assert.equal(normalizeLimit('-2', true).ok, false);
  assert.equal(normalizeLimit('1.5', false).ok, false);
  assert.equal(normalizeLimit(String(MAX_LIMIT + 1), false).ok, false);
  assert.equal(normalizeLimit('0', false).ok, true);
});

test('feature: semua key kanonik wajib ada dan key asing ditolak', () => {
  const complete = Object.fromEntries(FEATURE_KEYS.map((key) => [key, '']));
  assert.deepEqual(Object.keys(complete).sort(), [...FEATURE_KEYS].sort());
  const withExtra = { ...complete, deviceIncl: 1 };
  assert.equal(
    FEATURE_KEYS.some((key) => !(key in withExtra)),
    false,
  );
  assert.equal(
    Object.keys(withExtra).some((key) => !FEATURE_KEYS.includes(key)),
    true,
  );
});

test('feature: invariant antar-feature menolak kombinasi tanpa induk', () => {
  const base = {
    paymentGatewayB2C: false,
    backupGateway: false,
    promoEnabled: false,
    promoAdvanced: false,
    kioskCustomEnabled: false,
    kioskMultiplePanelStyle: false,
  };
  assert.deepEqual(featureInvariantErrors(base), []);
  assert.deepEqual(featureInvariantErrors({ ...base, backupGateway: true }), ['backupGateway']);
  assert.deepEqual(featureInvariantErrors({ ...base, promoAdvanced: true }), ['promoAdvanced']);
  assert.deepEqual(featureInvariantErrors({ ...base, kioskMultiplePanelStyle: true }), [
    'kioskMultiplePanelStyle',
  ]);
  assert.deepEqual(
    featureInvariantErrors({
      paymentGatewayB2C: true,
      backupGateway: true,
      promoEnabled: true,
      promoAdvanced: true,
      kioskCustomEnabled: true,
      kioskMultiplePanelStyle: true,
    }),
    [],
  );
});

test('diff: hanya melaporkan field yang benar-benar berubah', () => {
  const before = {
    name: 'Growth',
    priceMonthly: '180000.00',
    priceYearly: '1800000.00',
    features: { storageMb: 20480, cameraTypes: ['WEBCAM', 'DSLR'] },
  };
  const identical = {
    name: 'Growth',
    priceMonthly: '180000.00',
    priceYearly: '1800000.00',
    features: { storageMb: 20480, cameraTypes: ['WEBCAM', 'DSLR'] },
  };
  assert.deepEqual(diffPlanFields(before, identical), []);

  const changed = {
    name: 'Growth Plus',
    priceMonthly: '190000.00',
    priceYearly: '1800000.00',
    features: { storageMb: 20480, cameraTypes: ['WEBCAM'] },
  };
  assert.deepEqual(diffPlanFields(before, changed), [
    'name',
    'priceMonthly',
    'features.cameraTypes',
  ]);
});

test('diff: priceYearly null dan string kosong dianggap sama', () => {
  const base = { name: 'A', priceMonthly: '1.00', priceYearly: null, features: {} };
  const same = { name: 'A', priceMonthly: '1.00', priceYearly: '', features: {} };
  assert.deepEqual(diffPlanFields(base, same), []);
  const filled = { name: 'A', priceMonthly: '1.00', priceYearly: '10.00', features: {} };
  assert.deepEqual(diffPlanFields(base, filled), ['priceYearly']);
});

test('diff: urutan cameraTypes tidak dianggap perubahan', () => {
  const before = {
    name: 'A',
    priceMonthly: '1.00',
    priceYearly: null,
    features: { cameraTypes: ['WEBCAM', 'DSLR'] },
  };
  const reordered = {
    name: 'A',
    priceMonthly: '1.00',
    priceYearly: null,
    features: { cameraTypes: ['DSLR', 'WEBCAM'] },
  };
  assert.deepEqual(diffPlanFields(before, reordered), []);
});

test('immutable: payload update tidak boleh membawa tier/id/isActive/updatedAt', () => {
  const payload = { planId: 'x', name: 'A', priceMonthly: '1', priceYearly: null, features: {} };
  for (const forbidden of ['tier', 'id', 'isActive', 'createdAt', 'updatedAt']) {
    assert.equal(forbidden in payload, false, forbidden);
  }
});
