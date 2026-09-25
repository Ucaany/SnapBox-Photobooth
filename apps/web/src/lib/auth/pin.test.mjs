/**
 * Self-check PIN hashing (PRD Bab 8.5: "PIN brute force protected").
 *
 * Dijalankan `node --test` dari root repo. Berkas test lain direncanakan
 * memakai pola `*.test.mjs` yang sama; helper murni Node `node:crypto`,
 * sehingga tidak butuh TypeScript loader.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { Buffer } from 'node:buffer';

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const PARAMS = { N: 16384, r: 8, p: 1 };
const PIN_PATTERN = /^\d{6}$/;

function toBase64Url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

async function hashPin(pin) {
  if (!PIN_PATTERN.test(pin)) throw new Error('PIN operator harus tepat 6 digit.');

  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(pin, salt, KEY_LENGTH, PARAMS);

  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, toBase64Url(salt), toBase64Url(derived)].join(
    '$',
  );
}

async function verifyPin(pin, storedHash) {
  if (!PIN_PATTERN.test(pin)) return false;
  if (!storedHash) return false;

  const parts = storedHash.split('$');
  if (parts.length !== 6) return false;

  const [scheme, nRaw, rRaw, pRaw, saltRaw, keyRaw] = parts;
  if (scheme !== 'scrypt') return false;

  const N = Number.parseInt(nRaw, 10);
  const r = Number.parseInt(rRaw, 10);
  const p = Number.parseInt(pRaw, 10);
  if (!Number.isInteger(N) || N < 4096 || N > 1 << 20) return false;
  if (!Number.isInteger(r) || r < 1 || r > 32) return false;
  if (!Number.isInteger(p) || p < 1 || p > 16) return false;

  const salt = Buffer.from(saltRaw, 'base64url');
  const expected = Buffer.from(keyRaw, 'base64url');
  if (expected.length !== KEY_LENGTH) return false;

  const derived = await scrypt(pin, salt, expected.length, { N, r, p });
  if (derived.length !== expected.length) return false;

  return derived.equals(expected);
}

test('hash PIN round-trip', async () => {
  const hash = await hashPin('123456');
  assert.match(hash, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPin('123456', hash), true);
});

test('PIN salah ditolak', async () => {
  const hash = await hashPin('123456');
  assert.equal(await verifyPin('654321', hash), false);
});

test('salt berbeda menghasilkan hash berbeda', async () => {
  const a = await hashPin('123456');
  const b = await hashPin('123456');
  assert.notEqual(a, b);
});

test('format hash rusak gagal tertutup', async () => {
  for (const bad of [
    null,
    '',
    'scrypt',
    'scrypt$16384$8$1$onlyfourparts',
    'bcrypt$16384$8$1$c2FsdA$a2V5',
    'scrypt$1024$8$1$c2FsdA$a2V5',
    'scrypt$16384$0$1$c2FsdA$a2V5',
    'scrypt$16384$8$99$c2FsdA$a2V5',
  ]) {
    assert.equal(await verifyPin('123456', bad), false, `seharusnya ditolak: ${String(bad)}`);
  }
});

test('PIN non-6-digit tidak pernah di-hash', async () => {
  await assert.rejects(() => hashPin('12345'));
  await assert.rejects(() => hashPin('1234567'));
  await assert.rejects(() => hashPin('abcdef'));
  assert.equal(await verifyPin('abcdef', await hashPin('123456')), false);
});
