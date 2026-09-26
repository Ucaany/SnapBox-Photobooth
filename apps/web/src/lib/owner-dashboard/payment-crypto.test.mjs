/* global process, Buffer */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ENCRYPTION_MASTER_KEY = Buffer.alloc(32, 7).toString('base64');
const { encryptPaymentSecret, decryptPaymentSecret } = await import('./payment-crypto.ts');

test('payment credential encryption round trips and rejects tampering', () => {
  const encrypted = encryptPaymentSecret('secret-value');
  assert.equal(decryptPaymentSecret(encrypted), 'secret-value');
  encrypted[encrypted.length - 1] ^= 1;
  assert.throws(() => decryptPaymentSecret(encrypted));
});
