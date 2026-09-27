import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(rootDir, path), 'utf8');
const ownerTables = [
  'outlets',
  'booths',
  'devices',
  'pairing_tokens',
  'device_calibrations',
  'frames',
  'frame_versions',
  'booth_frames',
  'templates',
  'packages',
  'kiosk_themes',
  'kiosk_theme_versions',
  'promos',
  'promo_redemptions',
  'b2c_payment_configs',
  'transactions',
  'paper_logs',
  'customers',
  'download_tokens',
  'sessions',
  'webhook_events',
  'webhook_failures',
  'device_logs',
  'camera_compatibility',
];

test('Task 2.19 tables exist in baseline and all have RLS enabled', () => {
  const ddl = read('packages/db/migrations/0000_smiling_hawkeye.sql');
  const policies = read('packages/db/migrations/0001_rls_and_realtime.sql');
  const rlsTables = policies.match(/foreach table_name in array array\[([\s\S]*?)\]/)?.[1];
  assert.ok(rlsTables, 'RLS table inventory missing');
  for (const table of ownerTables) {
    assert.match(ddl, new RegExp(`CREATE TABLE "${table}"`), `baseline missing ${table}`);
    assert.ok(rlsTables.includes(`'${table}'`), `RLS inventory missing ${table}`);
  }
});

test('Phase 2 migration is additive, journaled, and ordered before Supabase post-Drizzle migrations', () => {
  const migration = read('packages/db/migrations/0005_phase_2_owner_rls.sql');
  const journal = read('packages/db/migrations/meta/_journal.json');
  const runner = read('scripts/migrate-ordered.mjs');
  assert.doesNotMatch(migration, /\b(create|alter)\s+table\b/i);
  assert.match(journal, /"idx":\s*5,[\s\S]*?"tag":\s*"0005_phase_2_owner_rls"/);
  assert.match(runner, /Drizzle 0000-0006/);
});

test('D-01: default palet kiosk biru, dan migrasinya sejalan dengan skema', () => {
  // Ditemukan saat review: `.default()` di `src/schema.ts` diubah ke palet biru
  // sementara `0000_smiling_hawkeye.sql` masih `#FFDD00/#8B5CF6/#FFFEF5`, dan
  // `kiosk-theme-server.ts` menyisipkan baris tanpa warna sehingga DEFAULT kolom
  // itulah yang benar-benar dipakai kiosk. Uji ini mengunci ketiganya.
  const schema = read('packages/db/src/schema.ts');
  const baseline = read('packages/db/migrations/0000_smiling_hawkeye.sql');
  const journal = read('packages/db/migrations/meta/_journal.json');
  const migration = read('packages/db/migrations/0006_kiosk_theme_blue_defaults.sql');

  // Skema memakai ramp biru, bukan palet PRD yang sudah dicabut. Dicocokkan per
  // baris: rantai builder memuat `{ length: 9 }`, jadi pola `[^)]*` tidak cukup.
  const schemaLine = (column) =>
    schema.split('\n').find((line) => line.includes(`'${column}'`)) ?? '';
  assert.match(schemaLine('primary_color'), /\.default\('#5294FF'\)/);
  assert.match(schemaLine('accent_color'), /\.default\('#1D4ED8'\)/);
  assert.match(schemaLine('background_color'), /\.default\('#DCEBFE'\)/);

  // Baseline masih menyimpan default lama; itu justru alasan migrasi ini ada.
  assert.match(baseline, /"primary_color" varchar\(9\) DEFAULT '#FFDD00' NOT NULL/);

  // Migrasi dijurnal sebagai 0006 dan menetapkan ulang ketiga DEFAULT ke biru.
  assert.match(journal, /"idx":\s*6,[\s\S]*?"tag":\s*"0006_kiosk_theme_blue_defaults"/);
  assert.match(migration, /ALTER COLUMN primary_color SET DEFAULT '#5294FF'/);
  assert.match(migration, /ALTER COLUMN accent_color SET DEFAULT '#1D4ED8'/);
  assert.match(migration, /ALTER COLUMN background_color SET DEFAULT '#DCEBFE'/);

  // Migrasi TIDAK boleh menyentuh baris lama: backfill adalah keputusan data
  // terpisah, dan tebakan di sini akan menimpa tema yang sudah dikustom owner.
  assert.doesNotMatch(migration, /\bUPDATE\b/i);
});

test('jurnal migrasi naik monoton dan tidak mendahului waktu', () => {
  // Ditemukan saat review. Drizzle menerapkan migrasi hanya bila
  // `lastDbMigration.created_at < migration.folderMillis`
  // (drizzle-orm/pg-core/dialect.cjs). Dua konsekuensi yang saling mengunci:
  //
  //  - `when` yang TIDAK naik monoton membuat migrasi berikutnya DILEWATI pada
  //    database yang sudah menerapkan pendahulunya. Contohnya `0006` yang
  //    didahului `0005` harus punya `when` lebih besar dari `0005`.
  //  - `when` yang berada di MASA DEPAN membuat migrasi yang di-generate
  //    berikutnya (yang memakai `Date.now()`) bernilai lebih kecil, sehingga
  //    ikut dilewati secara diam-diam.
  //
  // Uji ini mengunci keduanya supaya entri berikutnya tidak mengulanginya.
  const journal = JSON.parse(read('packages/db/migrations/meta/_journal.json'));

  for (let i = 1; i < journal.entries.length; i++) {
    const previous = journal.entries[i - 1];
    const current = journal.entries[i];
    assert.ok(
      current.when > previous.when,
      `jurnal tidak monoton: ${current.tag} (${current.when}) harus > ${previous.tag} (${previous.when})`,
    );
  }

  const now = Date.now();
  const future = journal.entries.filter((entry) => entry.when > now);
  // Toleransi kecil untuk jam mesin yang bergeser antar-lingkungan CI.
  const SLACK_MS = 60 * 60 * 1000;
  const offenders = future.filter((entry) => entry.when - now > SLACK_MS);
  assert.deepEqual(
    offenders.map((entry) => `${entry.tag}@${entry.when}`),
    [],
    'entri jurnal bertanggal jauh di masa depan akan membuat migrasi berikutnya dilewati',
  );
});

test('owner RLS closes parent mismatches and keeps camera registry read-only public', () => {
  const migration = read('packages/db/migrations/0005_phase_2_owner_rls.sql');
  for (const table of [
    'devices',
    'pairing_tokens',
    'packages',
    'kiosk_themes',
    'sessions',
    'transactions',
    'download_tokens',
    'promo_redemptions',
  ]) {
    assert.match(migration, new RegExp(`CREATE POLICY snapbox_${table}_tenant`));
  }
  assert.match(
    migration,
    /CREATE POLICY snapbox_booth_frames_parent[\s\S]*?b\.tenant_id = f\.tenant_id/,
  );
  assert.match(
    migration,
    /CREATE POLICY snapbox_promos_tenant[\s\S]*?tenant_id IS NOT NULL AND tenant_id = app\.current_tenant_id\(\)/,
  );
  assert.match(
    migration,
    /GRANT SELECT ON TABLE public\.camera_compatibility TO anon, authenticated/,
  );
  assert.match(
    migration,
    /CREATE POLICY snapbox_camera_compatibility_public_read[\s\S]*?FOR SELECT TO anon, authenticated USING \(true\)/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.device_calibrations FROM anon, authenticated/,
  );
  assert.doesNotMatch(migration, /GRANT [^;]*(?:INSERT|UPDATE|DELETE)[^;]*camera_compatibility/i);
});
