import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new NodeURL('../../', import.meta.url));
const source = async (path) => readFile(`${root}${path}`, 'utf8');

test('owner notifications are tenant/user scoped and expired rows hidden', async () => {
  const query = await source('lib/owner-dashboard/owner-account-server.ts');
  const action = await source('app/(owner-dashboard)/owner-dashboard/notifications/actions.ts');
  assert.match(query, /eq\(notifications\.userId, userId\)/);
  assert.match(query, /eq\(notifications\.tenantId, tenantId\)/);
  assert.match(query, /notifications\.expiresAt/);
  assert.match(action, /eq\(notifications\.userId, auth\.session\.userId\)/);
  assert.match(action, /eq\(notifications\.tenantId, auth\.tenantId\)/);
});

test('profile input excludes identity fields and support input is bounded', async () => {
  const contract = await source('lib/owner-dashboard/owner-account-contract.ts');
  const support = await source('app/(owner-dashboard)/owner-dashboard/support/actions.ts');
  assert.match(contract, /fullName: z\.string\(\).*max\(150\)/s);
  assert.match(contract, /message: z\.string\(\)\.trim\(\)\.min\(10\)\.max\(4000\)/);
  const updateAction = await source('app/(owner-dashboard)/owner-dashboard/settings/actions.ts');
  assert.doesNotMatch(
    updateAction.slice(0, updateAction.indexOf('export async function getOwnerSettings')),
    /email:|role:|tenantId:/,
  );
  assert.match(support, /requireOwnerTenant\(\)/);
  assert.match(await source('lib/email/resend.ts'), /SUPPORT_EMAIL/);
});
