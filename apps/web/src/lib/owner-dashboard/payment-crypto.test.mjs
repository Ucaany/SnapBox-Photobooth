/* global process, Buffer */
import test from 'node:test';
import assert from 'node:assert/strict';

const testSecret = Buffer.alloc(32, 7).toString('base64');
Object.assign(process.env, {
  ENCRYPTION_MASTER_KEY: testSecret,
  PAIRING_TOKEN_SECRET: testSecret,
  LAN_JWT_SECRET: testSecret,
  DEVICE_JWT_SECRET: testSecret,
  SESSION_COOKIE_SECRET: testSecret,
});
const { encryptPaymentSecret, decryptPaymentSecret } = await import('./payment-crypto.ts');

test('payment credential encryption round trips and rejects tampering', () => {
  const encrypted = encryptPaymentSecret('secret-value');
  assert.equal(decryptPaymentSecret(encrypted), 'secret-value');
  encrypted[encrypted.length - 1] ^= 1;
  assert.throws(() => decryptPaymentSecret(encrypted));
});
