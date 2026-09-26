import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const contract = fs.readFileSync(path.join(here, 'package-contract.ts'), 'utf8');

test('package contract enforces persisted field boundaries', () => {
  assert.match(contract, /name: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(100\)/);
  assert.match(contract, /price: z\.string\(\)\.regex/);
  assert.match(contract, /z\.string\(\)\.uuid\(\)/);
  assert.match(contract, /z\.enum\(\['2x6', '4x6'\]\)/);
  assert.match(contract, /'INVALID_INPUT'.*'UNAUTHORIZED'.*'NOT_FOUND'.*'SERVER_ERROR'/);
});

test('package actions parse before auth and scope mutations to tenant', () => {
  const actions = fs.readFileSync(
    path.join(here, '../../app/(owner-dashboard)/owner-dashboard/packages/actions.ts'),
    'utf8',
  );
  assert.ok(
    actions.indexOf('packageInputSchema.safeParse') < actions.indexOf('requireOwnerTenant()'),
  );
  assert.match(actions, /eq\(packages\.tenantId, auth\.tenantId\)/g);
  assert.match(actions, /eq\(booths\.tenantId, tenantId\)/);
  assert.match(actions, /deletePackage/);
});
