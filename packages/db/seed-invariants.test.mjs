// Invariant Task 1.12 (PRD baris 1994): migrations + seed untuk tabel auth/tenant.
//
// Sama seperti `tests/smoke.test.mjs`, test ini membaca berkas sebagai teks dan
// TIDAK menyentuh DB/Firebase/Resend. Yang diuji adalah INVARIAN yang mudah
// rusak tanpa terlihat: DDL tidak diduplikasi, RLS tidak kehilangan satu tabel,
// seed tidak pernah memuat secret, dan policy broadcast tidak salah bentuk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Berkas ini duduk di `packages/db/`, jadi root repo adalah dua level di atas.
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(relPath) {
  return readFileSync(join(rootDir, relPath), 'utf8');
}

// Delapan tabel Task 1.12 (PRD baris 1994). Urutan sengaja tetap.
const TASK_1_12_TABLES = [
  'users',
  'tenants',
  'plans',
  'b2b_subscriptions',
  'activity_logs',
  'notifications',
  'broadcasts',
  'promos',
];

test('migration Drizzle 0000 membuat kedelapan tabel Task 1.12', () => {
  const ddl = read('packages/db/migrations/0000_smiling_hawkeye.sql');
  for (const table of TASK_1_12_TABLES) {
    assert.match(
      ddl,
      new RegExp(`CREATE TABLE "${table}"`),
      `0000_smiling_hawkeye.sql harus membuat tabel "${table}"`,
    );
  }
});

test('migration RLS 0001 mengaktifkan RLS untuk kedelapan tabel Task 1.12', () => {
  const rls = read('packages/db/migrations/0001_rls_and_realtime.sql');
  const block = rls.match(/foreach table_name in array array\[([\s\S]*?)\]/);
  assert.ok(block, 'blok app.enforce_rls tidak ditemukan di 0001_rls_and_realtime.sql');
  for (const table of TASK_1_12_TABLES) {
    assert.ok(
      block[1].includes(`'${table}'`),
      `RLS 0001 harus memanggil app.enforce_rls untuk "${table}"`,
    );
  }
});

test('seed mendeklarasikan 3 tier plan dan 3 tenant contoh dari PRD Bab 9', () => {
  const seed = read('packages/db/src/seed.ts');
  for (const tier of ['STARTER', 'GROWTH', 'ENTERPRISE']) {
    assert.ok(seed.includes(`tier: '${tier}'`), `seed harus memuat plan tier ${tier}`);
  }
  for (const company of ['Pixelbooth Indonesia', 'Snap Moment Studio', 'Klik Klik Photobooth']) {
    assert.ok(seed.includes(company), `seed harus memuat tenant contoh "${company}"`);
  }
});

test('seed memakai firebase_uid placeholder berawalan "seed:"', () => {
  const seed = read('packages/db/src/seed.ts');
  assert.match(
    seed,
    /const seedFirebaseUid = `seed:\$\{seed\.slug\}`/,
    'firebase_uid seed harus berbentuk seed:<slug>, bukan UID Firebase nyata',
  );
  // Nilai placeholder itu yang benar-benar ditulis ke baris user.
  assert.match(
    seed,
    /firebaseUid:\s*seedFirebaseUid/,
    'insert/update user harus memakai seedFirebaseUid, bukan UID lain',
  );
});

test('seed tidak pernah memuat kolom secret/kredensial', () => {
  const seed = read('packages/db/src/seed.ts');
  // Cek bentukan ASSIGNMENT (`kolom:` atau `kolom =`), bukan sekadar penyebutan
  // nama: `deviceFingerprint` sah muncul di predikat `isNull(...)` saat memilih
  // booth seed, yang justru menegaskan booth itu tidak pernah diberi fingerprint.
  for (const forbidden of [
    'pinLockPinHash',
    'operatorPinHash',
    'sessionJwtHash',
    'deviceFingerprint',
    'apiKeyEncrypted',
    'secretKeyEncrypted',
    'pakasirInvoiceId',
    'PAKASIR_B2B',
  ]) {
    const assigned = new RegExp(`\\b${forbidden}\\s*:`);
    assert.ok(!assigned.test(seed), `seed tidak boleh menulis kolom/secret "${forbidden}"`);
  }
});

test('migration broadcast tenant-scope ada, policy-only, dan tidak menduplikasi DDL', () => {
  const relPath = 'supabase/migrations/20260101000600_broadcast_tenant_scope.sql';
  assert.ok(existsSync(join(rootDir, relPath)), `${relPath} harus ada`);
  const sql = read(relPath);
  // Buang komentar dulu: header file menyebut "create table" secara eksplisit
  // untuk menjelaskan apa yang TIDAK dilakukan.
  const withoutComments = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');

  assert.ok(
    !/create\s+table/i.test(withoutComments),
    'migration broadcast scope harus policy-only; DDL tabel hidup di packages/db/migrations/0000',
  );

  assert.match(
    sql,
    /create policy snapbox_broadcasts_tenant_read on public\.broadcasts\s+for select to authenticated/i,
    'policy harus berupa SELECT tenant-scoped pada public.broadcasts',
  );

  // Predikat diperiksa DI DALAM klausa `using (...)`, bukan sekadar "ada di
  // berkas". Tanpa ekstraksi ini, memindahkan `jsonb_exists`/`current_tenant_id`
  // ke luar policy tetap lolos test padahal proteksinya hilang.
  const usingClause = withoutComments.match(/\busing\s*\(([\s\S]*?)\)\s*;/);
  assert.ok(usingClause, 'policy harus punya klausa using (...)');
  assert.ok(
    usingClause[1].includes('jsonb_exists(') && usingClause[1].includes('app.current_tenant_id()'),
    'klausa using harus memakai jsonb_exists(target_tenant_ids, app.current_tenant_id())',
  );
  assert.ok(
    usingClause[1].includes('target_all'),
    'klausa using harus tetap memberi akses untuk broadcast target_all',
  );
  assert.ok(
    !/drop policy if exists snapbox_broadcasts_ceo/i.test(sql),
    'policy CEO lama dari 0001 tidak boleh di-drop',
  );
});

test('seed tidak pernah menimpa tenant/user/langganan nyata', () => {
  const seed = read('packages/db/src/seed.ts');

  // Tenant: baris non-seed (notes bukan SEED_NOTE) harus dilewati, bukan di-update.
  assert.match(
    seed,
    /existingTenant\.notes\s*!==\s*SEED_NOTE/,
    'seed harus membandingkan penanda notes sebelum menulis ulang tenant',
  );

  // User: hanya baris ber-firebase_uid seed yang boleh di-update.
  assert.match(
    seed,
    /existingUser\.firebaseUid\s*!==\s*seedFirebaseUid/,
    'seed harus membandingkan firebase_uid sebelum menulis ulang user',
  );

  // Langganan: pencarian baris existing dibatasi ke baris tanpa invoice Pakasir.
  const subBlock = seed.match(/const \[existingSub\][\s\S]*?\.limit\(1\);/);
  assert.ok(subBlock, 'blok pencarian existingSub harus ada');
  assert.ok(
    subBlock[0].includes('isNull(b2bSubscriptions.pakasirInvoiceId)'),
    'pencarian langganan seed harus mengecualikan baris ber-invoice Pakasir',
  );
});
