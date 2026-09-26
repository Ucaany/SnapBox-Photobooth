import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const contract = fs.readFileSync(path.join(here, 'machine-contract.ts'), 'utf8');
const server = fs.readFileSync(path.join(here, 'machine-server.ts'), 'utf8');
const actions = fs.readFileSync(
  path.join(here, '../../app/(owner-dashboard)/owner-dashboard/machines/actions.ts'),
  'utf8',
);
const pairing = fs.readFileSync(
  path.join(here, '../../app/(owner-dashboard)/owner-dashboard/machines/pairing-session.ts'),
  'utf8',
);
const route = fs.readFileSync(path.join(here, '../../app/api/booth/pair-session/route.ts'), 'utf8');

test('machine contract keeps trust-boundary invariants', () => {
  assert.match(contract, /machineIdSchema = z\.string\(\)\.uuid\(\)/);
  assert.match(contract, /HEARTBEAT_OFFLINE_SECONDS = 90/);
  assert.match(contract, /INVALID_INPUT/);
  assert.match(contract, /NOT_FOUND/);
});

test('machine reads scope tenant and never select secret columns', () => {
  assert.match(server, /eq\(booths\.tenantId, tenantId\)/);
  assert.match(server, /eq\(packages\.tenantId, tenantId\)/);
  assert.match(server, /eq\(sessions\.tenantId, tenantId\)/);
  assert.doesNotMatch(server, /pairingCodeHash|pinLockPinHash|operatorPinHash|sessionJwtHash/);
});

test('mutations are tenant-scoped and revoke does not delete booths', () => {
  assert.match(actions, /eq\(booths\.tenantId, auth\.tenantId\)/);
  assert.match(actions, /eq\(packages\.tenantId, auth\.tenantId\)/);
  assert.match(actions, /deviceQuota/);
  assert.match(actions, /isRevoked: true/);
  assert.doesNotMatch(actions, /delete\(booths\)/);
  assert.doesNotMatch(actions, /tenantId:\s*(input|parsed\.data|parsed\.data\.tenantId)/);
});

test('pairing stores hash only, expires in 10 minutes, and revokes prior tokens', () => {
  assert.match(pairing, /createHash\('sha256'\)/);
  assert.match(pairing, /PAIRING_TTL_MS = 10 \* 60 \* 1000/);
  assert.match(pairing, /manualCode: null/);
  assert.match(pairing, /used: true/);
  assert.doesNotMatch(pairing, /manualCode:\s*manualCode/);
});

test('pair-session route authorizes owner and rejects paired booth', () => {
  assert.match(route, /requireOwnerTenant/);
  assert.match(route, /requireOwnerTenant\(\)/);
  assert.match(route, /booth\.fingerprint/);
  assert.match(route, /user choice|qrPngDataUrl/);
  assert.match(route, /sessionCode/);
});
