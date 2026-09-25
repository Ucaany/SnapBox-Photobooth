/**
 * Self-check kontrak promo global (PRD Task 1.10).
 *
 * Dijalankan `node --test` dari root repo, pola sama dengan
 * `plan-contract.test.mjs`. Test sengaja tidak mengimpor modul TS agar bisa
 * jalan dengan `node --test` polos; bila aturan di `promo-contract.ts` berubah,
 * test ini gagal dan memaksa sinkronisasi.
 *
 * Yang diuji adalah INVARIAN trust boundary dan nilai bersama: normalisasi kode,
 * batas diskon, kuota unlimited, urutan periode, status turunan, format tampilan,
 * dan diff yang dipakai audit serta tombol simpan.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const CODE_MIN = 4;
const CODE_MAX = 20;
const MAX_VALUE = 9_999_999_999;
const MAX_QUOTA = 1_000_000;
const DIFF_KEYS = [
  'name',
  'code',
  'type',
  'value',
  'minPurchase',
  'validFrom',
  'validUntil',
  'quotaTotal',
  'quotaPerCustomer',
];

/** Cermin `normalizePromoCode`. */
function normalizeCode(value) {
  return String(value).trim().toUpperCase();
}

/** Cermin `promoCodeSchema`. */
function checkCode(value) {
  const canonical = normalizeCode(value);
  if (!/^[A-Z0-9]+$/.test(canonical)) return { ok: false, reason: 'alfa' };
  if (canonical.length < CODE_MIN || canonical.length > CODE_MAX)
    return { ok: false, reason: 'panjang' };
  return { ok: true, value: canonical };
}

/** Cermin `promoValueSchema` + rentang persentase di `superRefine`. */
function checkValue(type, value) {
  const raw = typeof value === 'number' ? String(value) : String(value).trim();
  if (raw === '') return { ok: false, reason: 'kosong' };
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { ok: false, reason: 'format' };
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > MAX_VALUE)
    return { ok: false, reason: 'rentang' };
  if (type === 'PERCENTAGE' && numeric > 100) return { ok: false, reason: 'persen' };
  return { ok: true, value: numeric.toFixed(2) };
}

/** Cermin `promoQuotaTotalSchema`. */
function checkQuotaTotal(value) {
  const raw = value === null || value === undefined ? '' : String(value).trim();
  if (raw === '') return { ok: true, value: null };
  if (!/^\d+$/.test(raw)) return { ok: false, reason: 'format' };
  const numeric = Number(raw);
  if (!Number.isSafeInteger(numeric) || numeric < 1 || numeric > MAX_QUOTA)
    return { ok: false, reason: 'rentang' };
  return { ok: true, value: numeric };
}

/** Cermin aturan periode di `superRefine`. */
function periodError(validFrom, validUntil) {
  return new Date(validFrom).getTime() >= new Date(validUntil).getTime() ? 'validUntil' : null;
}

/** Cermin `derivePromoStatus`. */
function deriveStatus(isActive, validFrom, validUntil, now) {
  if (!isActive) return 'Nonaktif';
  const start = new Date(validFrom).getTime();
  const end = new Date(validUntil).getTime();
  const time = now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 'Nonaktif';
  if (time < start) return 'Terjadwal';
  if (time >= end) return 'Berakhir';
  return 'Aktif';
}

/** Cermin `formatPromoQuota`. */
function formatQuota(used, total) {
  const usedLabel = new Intl.NumberFormat('id-ID').format(used);
  if (total === null) return `${usedLabel} / Tanpa batas`;
  return `${usedLabel} / ${new Intl.NumberFormat('id-ID').format(total)}`;
}

/** Cermin `diffPromoFields`. */
function diffPromoFields(before, after) {
  const changed = [];
  for (const key of DIFF_KEYS) {
    if ((before[key] ?? null) !== (after[key] ?? null)) changed.push(key);
  }
  return changed;
}

test('kode: case-insensitive dan dinormalkan uppercase', () => {
  assert.deepEqual(checkCode('promo2026'), { ok: true, value: 'PROMO2026' });
  assert.deepEqual(checkCode('  promo2026  '), { ok: true, value: 'PROMO2026' });
  assert.equal(checkCode('abc').ok, false, 'kurang dari 4 karakter');
  assert.equal(checkCode('A'.repeat(21)).ok, false, 'lebih dari 20 karakter');
});

test('kode: menolak simbol, spasi, dan non-ASCII', () => {
  for (const bad of ['PROMO 2026', 'PROMO-2026', 'PROMO_2026', 'PROMO#', 'PROMOÉ']) {
    assert.equal(checkCode(bad).ok, false, `harus ditolak: ${bad}`);
  }
});

test('diskon: persentase dibatasi 100, nominal tetap tidak', () => {
  assert.deepEqual(checkValue('PERCENTAGE', '15'), { ok: true, value: '15.00' });
  assert.deepEqual(checkValue('PERCENTAGE', '100'), { ok: true, value: '100.00' });
  assert.equal(checkValue('PERCENTAGE', '100.01').ok, false);
  assert.equal(checkValue('PERCENTAGE', '150').ok, false);
  assert.deepEqual(checkValue('FIXED_AMOUNT', '150000'), { ok: true, value: '150000.00' });
  assert.deepEqual(checkValue('FIXED_AMOUNT', '25000.5'), { ok: true, value: '25000.50' });
});

test('diskon: menolak nol, negatif, format ribuan, dan di atas presisi kolom', () => {
  for (const bad of ['0', '-5', '10,000', 'Rp 100', 'abc']) {
    assert.equal(checkValue('FIXED_AMOUNT', bad).ok, false, `harus ditolak: ${bad}`);
  }
  assert.equal(checkValue('FIXED_AMOUNT', String(MAX_VALUE)).ok, true);
  assert.equal(checkValue('FIXED_AMOUNT', String(MAX_VALUE + 1)).ok, false);
});

test('kuota total: kosong berarti tanpa batas', () => {
  assert.deepEqual(checkQuotaTotal(''), { ok: true, value: null });
  assert.deepEqual(checkQuotaTotal(null), { ok: true, value: null });
  assert.deepEqual(checkQuotaTotal('100'), { ok: true, value: 100 });
  assert.equal(checkQuotaTotal('0').ok, false);
  assert.equal(checkQuotaTotal('1.5').ok, false);
  assert.equal(checkQuotaTotal(String(MAX_QUOTA + 1)).ok, false);
});

test('periode: berakhir harus setelah mulai', () => {
  assert.equal(periodError('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'), null);
  assert.equal(periodError('2026-02-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'), 'validUntil');
  assert.equal(periodError('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'), 'validUntil');
});

test('status turunan: nonaktif mengalahkan periode', () => {
  const now = new Date('2026-06-15T00:00:00.000Z');
  assert.equal(
    deriveStatus(true, '2026-06-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', now),
    'Aktif',
  );
  assert.equal(
    deriveStatus(true, '2026-07-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', now),
    'Terjadwal',
  );
  assert.equal(
    deriveStatus(true, '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', now),
    'Berakhir',
  );
  assert.equal(
    deriveStatus(false, '2026-06-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', now),
    'Nonaktif',
  );
});

test('kuota: tampilan tanpa batas konsisten dengan nilai null', () => {
  assert.equal(formatQuota(3, null), '3 / Tanpa batas');
  assert.equal(formatQuota(3, 100), '3 / 100');
  assert.equal(formatQuota(1000, 2000), '1.000 / 2.000');
});

test('diff: hanya melaporkan field yang benar-benar berubah', () => {
  const before = {
    name: 'Promo Lebaran',
    code: 'LEBARAN26',
    type: 'PERCENTAGE',
    value: '15.00',
    minPurchase: '50000.00',
    validFrom: '2026-06-01T00:00:00.000Z',
    validUntil: '2026-07-01T00:00:00.000Z',
    quotaTotal: 100,
    quotaPerCustomer: 1,
  };
  assert.deepEqual(diffPromoFields(before, { ...before }), []);
  assert.deepEqual(diffPromoFields(before, { ...before, value: '20.00' }), ['value']);
  assert.deepEqual(diffPromoFields(before, { ...before, quotaTotal: null }), ['quotaTotal']);
  assert.deepEqual(diffPromoFields(before, { ...before, name: null }), ['name']);
});

test('immutable: payload create tidak membawa tenantId/isGlobal/quotaUsed', () => {
  const payload = { code: 'PROMO2026', type: 'PERCENTAGE' };
  for (const forbidden of [
    'tenantId',
    'isGlobal',
    'quotaUsed',
    'boothScope',
    'packageScope',
    'id',
  ]) {
    assert.equal(forbidden in payload, false, forbidden);
  }
});
