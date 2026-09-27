import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';

/**
 * Kontrak verifikasi signature webhook Pakasir (BE-026).
 *
 * BUG YANG INI TUTUP. `verifyPakasirSignature()` dulu membaca secret lewat
 * `readPakasirConfig()`, yang memvalidasi SELURUH `thirdPartyEnvSchema`.
 * Skema itu mensyaratkan `WHATSAPP_SALES_NUMBER` non-kosong. Jadi begitu satu
 * variabel yang sama sekali tidak ada hubungannya dengan pembayaran tidak
 * terisi, `readPakasirConfig()` melempar, catch-nya mengembalikan `false`, dan
 * SETIAP webhook pembayaran membalas 401. Tanpa log, tanpa error, tanpa jejak.
 *
 * Yang diuji di sini adalah sumber kebenarannya (`pakasirWebhookEnvSchema` dari
 * `@snapbox/shared/env`, yang disalin apa adanya ke berkas ini supaya test ini
 * jalan tanpa toolchain workspace) plus bentuk丢了 yang wajib dijaga: skema
 * verifikasi TIDAK boleh memuat kunci lain, dan secret yang kosong harus
 * melempar, bukan menjadi `false`.
 */
/**
 * Naik dari berkas test sampai root repo, bukan dengan menghitung `..`.
 * Menghitung tingkat rapuh: memindahkan test satu folder langsung menyalakannya
 * dengan ENOENT yang tidak menjelaskan apa pun.
 */
function findRepoRoot(from) {
  let current = from;
  while (current !== dirname(current)) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    current = dirname(current);
  }
  throw new Error('root repo tidak ditemukan: tidak ada pnpm-workspace.yaml di atas berkas test');
}

const rootDir = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(rootDir, path), 'utf8');

const PAKASIR_ADAPTER = 'apps/web/src/lib/ceo-dashboard/pakasir-b2b.ts';
const WEBHOOK_ROUTE = 'apps/web/src/app/api/webhooks/pakasir-b2b/route.ts';
const ENV_MODULE = 'packages/shared/src/env.ts';

/**
 * Cerminan `pakasirWebhookEnvSchema`: satu kunci, di-trim, wajib non-kosong.
 * whole-nya sengaja tidak diimpor supaya test ini jalan tanpa toolchain
 * workspace.
 */
function readWebhookSecret(source) {
  return (source.PAKASIR_B2B_WEBHOOK_SECRET ?? '').trim();
}

/** Signature HMAC yang benar untuk body dan secret tertentu. */
function sign(body, secret) {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

/**
 * Cerminan `verifyPakasirSignature` SESUDAH perbaikan, dengan pemisahan
 * `NOT_CONFIGURED` yang disalin dari adapter.
 */
function verifyPakasirSignature(rawBody, signature, readSecret) {
  if (!rawBody || !signature) return false;

  let webhookSecret;
  try {
    webhookSecret = readSecret();
  } catch (cause) {
    // Cerminan adapter: error yang sudah `NOT_CONFIGURED` diteruskan apa adanya,
    // error lain dibungkus. Yang PENTING dan yang diuji di bawah: tidak ada
    // `return false` di sini. Dulu ada, dan itulah yang membuat kesalahan
    // konfigurasi terlihat-identik dengan signature palsu.
    if (cause instanceof NotConfigured) throw cause;
    throw new NotConfigured('Kredensial webhook Pakasir tidak dapat dibaca.');
  }

  const expected = createHmac('sha256', webhookSecret).update(rawBody, 'utf8').digest('hex');
  const normalized = signature.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length !== expected.length) return false;
  return normalized === expected;
}

class NotConfigured extends Error {}

test('verifikasi tetap jalan saat variabel yang tidak terkait tidak terisi', () => {
  // Env: hanya satu variabel yang di了她bandingkan. `WHATSAPP_SALES_NUMBER`,
  // `RESEND_FROM_EMAIL`, dan sisanya TIDAK ADA — persis kondisi yang membuat
  // setiap webhook membalas 401 sebelum perbaikan.
  const env = { PAKASIR_B2B_WEBHOOK_SECRET: 'whsec-untuk-test' };
  const readSecret = () => {
    const value = readWebhookSecret(env);
    if (!value) throw new NotConfigured('PAKASIR_B2B_WEBHOOK_SECRET belum diset');
    return value;
  };

  const body = JSON.stringify({ event_id: 'evt-1', status: 'PAID' });
  assert.equal(verifyPakasirSignature(body, sign(body, 'whsec-untuk-test'), readSecret), true);
});

test('secret kosong adalah kesalahan konfigurasi, bukan signature yang salah', () => {
  const readSecret = () => {
    throw new NotConfigured('PAKASIR_B2B_WEBHOOK_SECRET belum diset');
  };
  assert.throws(
    () => verifyPakasirSignature('{}', 'a'.repeat(64), readSecret),
    NotConfigured,
    'secret kosong harus dilempar, bukan diterjemahkan jadi penolakan signature',
  );
});

test('signature yang benar-benar salah tetap ditolak, tanpa melempar', () => {
  const secret = 'whsec-untuk-test';
  const readSecret = () => secret;
  const body = '{"status":"PAID"}';
  assert.equal(verifyPakasirSignature(body, sign(body, 'secret-lain'), readSecret), false);
  assert.equal(verifyPakasirSignature(body, 'bukan-hex', readSecret), false);
  assert.equal(verifyPakasirSignature(body, null, readSecret), false);
  assert.equal(verifyPakasirSignature('', 'abc', readSecret), false);
});

test('skema verifikasi webhook hanya berisi kunci webhook secret', () => {
  const env = read(ENV_MODULE);
  const schema = /export const pakasirWebhookEnvSchema = z\.object\(\{([\s\S]*?)\}\);/.exec(env);
  assert.ok(schema, 'pakasirWebhookEnvSchema tidak ditemukan di packages/shared/src/env.ts');

  const keys = [...schema[1].matchAll(/^\s*([A-Z][A-Z0-9_]+)\s*:/gm)].map((m) => m[1]);
  assert.deepEqual(
    keys,
    ['PAKASIR_B2B_WEBHOOK_SECRET'],
    `skema verifikasi webhook harus tepat satu kunci, ditemukan: ${keys.join(', ')}`,
  );
});

test('adapter tidak memvalidasi thirdPartyEnvSchema di jalur signature', () => {
  const adapter = read(PAKASIR_ADAPTER);

  // `readPakasirWebhookSecret()` tidak boleh menyentuh skema vendor yang lebar.
  const reader = /export function readPakasirWebhookSecret\(\)[\s\S]*?\n}/.exec(adapter);
  assert.ok(reader, 'readPakasirWebhookSecret tidak ditemukan');
  assert.match(reader[0], /pakasirWebhookEnvSchema\.safeParse/);
  assert.doesNotMatch(
    reader[0],
    /thirdPartyEnvSchema/,
    'readPakasirWebhookSecret memvalidasi thirdPartyEnvSchema: BE-026 kembali',
  );

  // `verifyPakasirSignature` harus memakai reader sempit itu.
  const verifier = /export function verifyPakasirSignature\([\s\S]*?\n}/.exec(adapter);
  assert.ok(verifier, 'verifyPakasirSignature tidak ditemukan');
  assert.match(verifier[0], /readPakasirWebhookSecret\(\)/);
  assert.doesNotMatch(
    verifier[0],
    /catch\s*\{\s*return false;\s*\}/,
    'verifyPakasirSignature menelan kesalahan konfigurasi sebagai penolakan signature',
  );
});

test('route membedakan 401 signature salah dari 500 konfigurasi salah', () => {
  const route = read(WEBHOOK_ROUTE);
  const handler = route.slice(route.indexOf('export async function POST'));
  assert.match(handler, /try\s*\{[\s\S]*?verifyPakasirSignature/);
  assert.match(
    handler,
    /catch[\s\S]*?'configuration_error'\s*\}\s*,\s*500\)/,
    'kesalahan konfigurasi harus dibalas 500, bukan 401',
  );
  assert.match(handler, /'invalid_signature'\s*\}\s*,\s*401\)/);
});
