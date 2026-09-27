import assert from 'node:assert/strict';
import test from 'node:test';
import {
  csvCell,
  transactionExportSchema,
  transactionFilterSchema,
} from './transaction-contract.ts';

test('transaction filter rejects invalid date ranges and bounds pages', () => {
  assert.equal(
    transactionFilterSchema.safeParse({ from: '2026-09-20', to: '2026-09-01' }).success,
    false,
  );
  assert.equal(transactionFilterSchema.safeParse({ page: '100001' }).success, false);
  assert.equal(transactionFilterSchema.safeParse({ page: '2' }).data.page, 2);
});

test('transaction exports cap selected IDs and CSV cells neutralize formulas', () => {
  assert.equal(
    transactionExportSchema.safeParse({
      ids: Array(501).fill('00000000-0000-4000-8000-000000000000'),
    }).success,
    false,
  );
  assert.equal(csvCell('=SUM(A1:A2)'), `"'=SUM(A1:A2)"`);
  assert.equal(csvCell('a,"b"'), `"a,""b"""`);
});
