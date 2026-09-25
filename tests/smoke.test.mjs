// Smoke test wiring/invariant: membuktikan rangkaian tahap CI terpasang benar,
// BUKAN cakupan perilaku bisnis. Test fitur ada di Fase 7.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relPath) {
  return JSON.parse(readFileSync(join(rootDir, relPath), 'utf8'));
}

test('package.json root mendeklarasikan script workspace wajib', () => {
  const pkg = readJson('package.json');
  for (const name of ['build', 'lint', 'typecheck', 'test']) {
    assert.equal(typeof pkg.scripts?.[name], 'string', `script "${name}" harus ada`);
    assert.ok(pkg.scripts[name].trim().length > 0, `script "${name}" tidak boleh kosong`);
  }
});

test('package.json root menandai repo privat dengan Node dan pnpm terkunci', () => {
  const pkg = readJson('package.json');
  assert.equal(pkg.private, true);
  assert.ok(pkg.packageManager?.startsWith('pnpm@'), 'packageManager harus diawali "pnpm@"');
  assert.ok(pkg.engines?.node?.includes('>=22.12.0'), 'engines.node harus memuat ">=22.12.0"');
});

test('pnpm-workspace.yaml mencakup glob apps/* dan packages/*', () => {
  const content = readFileSync(join(rootDir, 'pnpm-workspace.yaml'), 'utf8');
  const globs = [...content.matchAll(/^\s*-\s*['"]?([^'"\n#]+?)['"]?\s*$/gm)].map((m) => m[1]);
  assert.ok(globs.includes('apps/*'), 'glob "apps/*" harus ada');
  assert.ok(globs.includes('packages/*'), 'glob "packages/*" harus ada');
});

test('tauri.conf.json membundel target nsis dan deb', () => {
  const conf = readJson('apps/desktop/src-tauri/tauri.conf.json');
  const targets = conf.bundle?.targets;
  assert.ok(Array.isArray(targets), 'bundle.targets harus array');
  assert.ok(targets.includes('nsis'), 'target "nsis" harus ada');
  assert.ok(targets.includes('deb'), 'target "deb" harus ada');
  assert.equal(targets.length, 2, 'bundle.targets harus tepat nsis dan deb');
});

test('tauri.conf.json memakai perintah build yang dipanggil CI', () => {
  const conf = readJson('apps/desktop/src-tauri/tauri.conf.json');
  assert.equal(conf.build?.beforeBuildCommand?.trim(), 'pnpm --filter @snapbox/desktop build');
});

test('seed Task 1.12 menetapkan satu tenant sample per tier plan', () => {
  const content = readFileSync(join(rootDir, 'packages/db/src/seed.ts'), 'utf8');
  const block = content.match(/const TENANT_SEEDS[^=]*=\s*\[([\s\S]*?)\n\];/)?.[1];
  assert.ok(block, 'TENANT_SEEDS harus terdeklarasi sebagai array literal');

  const tiers = [...block.matchAll(/planTier:\s*'([A-Z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    [...tiers].sort(),
    ['ENTERPRISE', 'GROWTH', 'STARTER'],
    'satu tenant sample untuk tiap tier Starter/Growth/Enterprise',
  );

  const emails = [...block.matchAll(/ownerEmail:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.equal(emails.length, 3, 'tiap tenant sample punya satu ownerEmail');
  assert.equal(new Set(emails).size, 3, 'ownerEmail tenant sample harus unik (kunci idempotensi)');
});
