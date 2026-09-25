/**
 * Self-check kontrak & signature invoice B2B (PRD Task 1.6).
 *
 * Dijalankan `node --test` dari root repo, pola sama dengan
 * `tenant-contract.test.mjs` dan `plan-contract.test.mjs`: test TIDAK mengimpor
 * modul TS agar bisa jalan dengan `node --test` polos. Aturan di
 * `subscription-contract.ts` dicerminkan di sini; bila salah satu berubah,
 * test ini gagal dan memaksa sinkronisasi.
 *
 * Yang diuji adalah INVARIAN trust boundary: pemetaan status presentasi (tanpa
 * enum `FAILED` baru), kelayakan retry, dan verifikasi HMAC-SHA256 constant-time
 * yang memakai `node:crypto` asli sehingga tidak bisa menyimpang dari produksi.
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

// ============ Cermin `invoiceDisplayStatus` ============

function invoiceDisplayStatus(row) {
  if (row.status === 'ACTIVE' || row.status === 'EXPIRING' || row.paidAt) return 'Lunas';
  if (row.status === 'PENDING') {
    if (row.lastAttemptFailed && !row.pakasirInvoiceId) return 'Gagal';
    return row.pakasirInvoiceId ? 'Menunggu' : 'Gagal';
  }
  if (row.status === 'GRACE_PERIOD' || row.status === 'EXPIRED') return 'Kedaluwarsa';
  if (row.status === 'CANCELLED') return 'Dibatalkan';
  if (row.status === 'SUSPENDED') return 'Kedaluwarsa';
  return 'Menunggu';
}

// ============ Cermin `isInvoiceRetryable` ============

function isInvoiceRetryable(row) {
  if (row.paidAt) return false;
  return row.status === 'PENDING' || row.status === 'GRACE_PERIOD' || row.status === 'EXPIRED';
}

// ============ Cermin `isPakasirPaidStatus` ============

function isPakasirPaidStatus(status) {
  return status === 'PAID' || status === 'SUCCESS' || status === 'SETTLED';
}

/** Cermin `verifyPakasirSignature` (hex, panjang sama, timing-safe). */
function verifyPakasirSignature(rawBody, signature, secret) {
  if (!rawBody || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const normalized = signature.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length !== expected.length) return false;
  return normalized === expected;
}

test('status presentasi: lunas hanya dari ACTIVE/paidAt', () => {
  assert.equal(
    invoiceDisplayStatus({ status: 'PENDING', pakasirInvoiceId: 'inv-1', paidAt: null }),
    'Menunggu',
  );
  assert.equal(
    invoiceDisplayStatus({
      status: 'PENDING',
      pakasirInvoiceId: null,
      paidAt: null,
      lastAttemptFailed: true,
    }),
    'Gagal',
  );
  assert.equal(
    invoiceDisplayStatus({ status: 'PENDING', pakasirInvoiceId: null, paidAt: null }),
    'Gagal',
  );
  assert.equal(
    invoiceDisplayStatus({ status: 'ACTIVE', pakasirInvoiceId: null, paidAt: null }),
    'Lunas',
  );
  assert.equal(
    invoiceDisplayStatus({ status: 'PENDING', pakasirInvoiceId: 'inv-1', paidAt: new Date() }),
    'Lunas',
  );
});

test('status presentasi: terminal dipetakan apa adanya tanpa enum FAILED', () => {
  assert.equal(
    invoiceDisplayStatus({ status: 'EXPIRED', pakasirInvoiceId: null, paidAt: null }),
    'Kedaluwarsa',
  );
  assert.equal(
    invoiceDisplayStatus({ status: 'GRACE_PERIOD', pakasirInvoiceId: null, paidAt: null }),
    'Kedaluwarsa',
  );
  assert.equal(
    invoiceDisplayStatus({ status: 'CANCELLED', pakasirInvoiceId: null, paidAt: null }),
    'Dibatalkan',
  );
});

test('retry hanya untuk invoice belum lunas', () => {
  assert.equal(isInvoiceRetryable({ status: 'PENDING', paidAt: null }), true);
  assert.equal(isInvoiceRetryable({ status: 'EXPIRED', paidAt: null }), true);
  assert.equal(isInvoiceRetryable({ status: 'GRACE_PERIOD', paidAt: null }), true);
  assert.equal(isInvoiceRetryable({ status: 'ACTIVE', paidAt: null }), false);
  assert.equal(isInvoiceRetryable({ status: 'CANCELLED', paidAt: null }), false);
  // paidAt menang atas status apa pun: baris lunas tidak pernah ditagih ulang.
  assert.equal(isInvoiceRetryable({ status: 'PENDING', paidAt: new Date() }), false);
});

test('hanya status provider PAID/SUCCESS/SETTLED yang mengaktifkan', () => {
  for (const status of ['PAID', 'SUCCESS', 'SETTLED']) {
    assert.equal(isPakasirPaidStatus(status), true);
  }
  for (const status of ['EXPIRED', 'FAILED', 'CANCELLED']) {
    assert.equal(isPakasirPaidStatus(status), false);
  }
});

test('signature: body utuh + secret benar diterima', () => {
  const body = '{"event_id":"evt-1","invoice_id":"inv-1","status":"PAID","amount":"100000.00"}';
  const secret = 'webhook-secret';
  const signature = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  assert.equal(verifyPakasirSignature(body, signature, secret), true);
  // Huruf besar tetap valid karena dinormalisasi ke lowercase.
  assert.equal(verifyPakasirSignature(body, signature.toUpperCase(), secret), true);
});

test('signature: body berubah atau secret salah ditolak', () => {
  const body = '{"event_id":"evt-1","invoice_id":"inv-1","status":"PAID","amount":"100000.00"}';
  const secret = 'webhook-secret';
  const signature = createHmac('sha256', secret).update(body, 'utf8').digest('hex');

  assert.equal(verifyPakasirSignature(`${body} `, signature, secret), false);
  assert.equal(verifyPakasirSignature(body, signature, 'secret-lain'), false);
});

test('signature: kosong, bukan-hex, dan panjang beda ditolak tanpa melempar', () => {
  const body = '{"a":1}';
  assert.equal(verifyPakasirSignature(body, null, 's'), false);
  assert.equal(verifyPakasirSignature('', 'abc', 's'), false);
  assert.equal(verifyPakasirSignature(body, 'zzzz', 's'), false);
  assert.equal(verifyPakasirSignature(body, 'abcd', 's'), false);
});
