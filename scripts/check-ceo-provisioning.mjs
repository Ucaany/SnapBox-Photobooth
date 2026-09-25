import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const validClaim = (claim) =>
  claim.role === 'authenticated' &&
  claim.app_role === 'CEO' &&
  claim.tenant_id === null &&
  claim.parent_tenant_id === null;
const accepts = (claim, user) =>
  validClaim(claim) &&
  user.firebase_uid === 'firebase-ceo-uid' &&
  user.role === 'CEO' &&
  user.disabled === false &&
  user.deleted_at === null &&
  user.tenant_id === null &&
  user.parent_tenant_id === null;

try {
  const claims = read('packages/auth/src/claims.ts');
  const authorization = read('apps/web/src/lib/auth/authorization.ts');
  const runbook = read('docs/CEO-PROVISIONING-RUNBOOK.md');
  for (const text of [claims, authorization, runbook])
    assert(
      !text.includes('FIREBASE_ADMIN_PRIVATE_KEY: "'),
      'real-looking private key literal found',
    );
  assert(claims.includes('role: z.literal(SUPABASE_POSTGRES_ROLE)'), 'wire role invariant missing');
  assert(claims.includes('app_role: userRoleSchema'), 'application role claim missing');
  assert(claims.includes("claims.app_role === 'CEO'"), 'CEO tenant invariant missing');
  assert(
    authorization.includes('findActiveUserByFirebaseUid(decoded.uid)'),
    'UID DB lookup missing',
  );
  assert(
    authorization.includes('claims.appRole !== user.role'),
    'claim/DB role equality check missing',
  );
  assert(authorization.includes("user.role === 'CEO'"), 'CEO session bypass missing');
  const user = {
    firebase_uid: 'firebase-ceo-uid',
    role: 'CEO',
    tenant_id: null,
    parent_tenant_id: null,
    disabled: false,
    deleted_at: null,
  };
  const valid = { role: 'authenticated', app_role: 'CEO', tenant_id: null, parent_tenant_id: null };
  assert(accepts(valid, user), 'valid CEO case must pass');
  for (const claim of [
    { ...valid, app_role: 'OWNER' },
    { ...valid, app_role: 'STAFF' },
    { ...valid, role: 'CEO' },
    { ...valid, tenant_id: '00000000-0000-4000-8000-000000000000' },
  ])
    assert(!accepts(claim, user), `invalid claim accepted: ${JSON.stringify(claim)}`);
  for (const row of [
    { ...user, role: 'OWNER' },
    { ...user, disabled: true },
    { ...user, deleted_at: '2026-09-25T00:00:00Z' },
    { ...user, firebase_uid: 'seed:example' },
  ])
    assert(!accepts(valid, row), `invalid DB row accepted: ${JSON.stringify(row)}`);
  console.log('OK: CEO provisioning invariants and negative role tests passed.');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
