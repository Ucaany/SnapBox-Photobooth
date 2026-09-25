import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

test('entitlement production code does not gate capabilities by Growth tier', async () => {
  const files = await sourceFiles('apps/web/src');
  const pattern = /(?:planTier|plan|tier)\s*===?\s*['"]GROWTH['"]/;
  const violations = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    if (pattern.test(text) && !file.endsWith('ceo-dashboard/tenants/actions.ts'))
      violations.push(file);
  }
  assert.deepEqual(violations, []);
});
