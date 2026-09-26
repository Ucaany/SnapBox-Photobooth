import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentSaveSchema, paymentTestSchema } from './payment-contract.ts';

test('payment contract validates provider credentials and DOKU merchant id', () => {
  const base = {
    provider: 'MIDTRANS',
    mode: 'SANDBOX',
    apiKey: 'key',
    secretKey: 'secret',
    isPrimary: true,
    isActive: true,
  };
  assert.equal(paymentSaveSchema.safeParse(base).success, true);
  assert.equal(paymentTestSchema.safeParse(base).success, true);
  assert.equal(paymentTestSchema.safeParse({ ...base, provider: 'DOKU' }).success, false);
  assert.equal(
    paymentTestSchema.safeParse({ ...base, provider: 'DOKU', merchantId: 'merchant' }).success,
    true,
  );
  assert.equal(
    paymentSaveSchema.safeParse({ ...base, apiKey: 'key', secretKey: undefined }).success,
    false,
  );
});
