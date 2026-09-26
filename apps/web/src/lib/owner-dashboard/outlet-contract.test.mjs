import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const contract = fs.readFileSync(path.join(here, 'outlet-contract.ts'), 'utf8');
const server = fs.readFileSync(path.join(here, 'outlet-server.ts'), 'utf8');
const actions = fs.readFileSync(
  path.join(here, '../../app/(owner-dashboard)/owner-dashboard/outlets/actions.ts'),
  'utf8',
);

test('outlet contract keeps trust-boundary invariants', () => {
  assert.match(contract, /name: z\.string\(\)\.trim\(\)\.min\(1/);
  assert.match(contract, /latitude/);
  assert.match(contract, /longitude/);
  assert.match(contract, /picPhone/);
  assert.match(contract, /z\.string\(\)\.uuid\(\)/);
  assert.match(contract, /INVALID_INPUT/);
});

test('outlet reads and mutations scope tenant and deactivate', () => {
  assert.match(server, /eq\(outlets\.tenantId, tenantId\)/g);
  assert.match(server, /eq\(booths\.tenantId, tenantId\)/g);
  assert.match(actions, /outletLimit/);
  assert.match(actions, /isActive/);
  assert.doesNotMatch(actions, /delete\(outlets\)/);
  assert.doesNotMatch(actions, /tenantId.*input|input.*tenantId/);
});
