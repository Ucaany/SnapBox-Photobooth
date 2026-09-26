import assert from 'node:assert/strict';
import test from 'node:test';
import { staffCreateSchema, staffUpdateSchema } from './staff-contract.ts';

test('staff contract normalizes identity and protects immutable email', () => {
  assert.equal(
    staffCreateSchema.parse({ fullName: '  Ada Lovelace ', email: ' ADA@EXAMPLE.COM ' }).email,
    'ada@example.com',
  );
  assert.equal(staffCreateSchema.safeParse({ fullName: 'A', email: 'bad' }).success, false);
  assert.equal(
    staffUpdateSchema.safeParse({ id: crypto.randomUUID(), fullName: 'Ada', email: 'x@y.com' })
      .success,
    false,
  );
});
