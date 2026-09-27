/**
 * GUARD 4 -- setiap kolom `tenant_id` wajib punya foreign key ke `public.tenants`.
 *
 * APA YANG DIGAGAK. `tenant_id` tanpa FK ke `tenants` berarti database tidak
 * yang memastikan nilainya menunjuk tenant yang benar. Aplikasi boleh saja
 * menulis `tenant_id` yang salah -- RLS membandingkan kolom itu ke
 * `app.current_tenant_id()`, jadi kalau kolomnya sendiri sudah salah, satu
 * predicate pun tidak bisa menolong. FK adalah satu-satunya tempat yang
 * menyatakan "nilai ini harus menunjuk tenant yang ada".
 *
 * BUKAN BAWAAN. 20 tabel punya kolom `tenant_id`, dan hanya sebagian yang
 * mendeklarasikan FK. Yang tidak, di违规 between lain:
 *   - `promo_redemptions` (BE-020/05c): `tenant_id` NOT NULL tanpa FK, padahal
 *     barisnya menunjuk `promo_id`. Redemption bisa mengklaim tenant A sambil
 *     menunjuk promo milik tenant B.
 *   - `users`, `activity_logs`: `tenant_id` nullable untuk baris platform, dan
 *     nullable TIDAKllaon excuses tidak adanya FK untuk baris tenant.
 *
 * CARA MENJAGA. Guard ini memindai TEKS `packages/db/src/schema.ts`, bukan
 * database, jadi jalan tanpa koneksi dan menangkap drift sebelum migration
 * dibuat. Dia memeriksa deklarasi FK, baik yang ditulis inline pada kolom
 * (`tenantId: uuid('tenant_id').references(...)`) maupun di baris lanjutannya --
 * bentuk kedua yang dipakai mayoritas tabel di repo ini, jadi check yang hanya
 * membaca satu baris akan salah menyimpulkan semua tabel hilang FK.
 *
 * PEMAKAIAN.
 *   node scripts/check-tenant-fk.mjs              cek repo
 *   node scripts/check-tenant-fk.mjs --self-test  guard menguji guard
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(root, 'packages/db/src/schema.ts');

/**
 * Ekstrak blok tiap `pgTable` beserta ekspresi kolom `tenantId`-nya.
 *
 * Dipisah dari I/O supaya bisa diuji mandiri tanpa berkas.
 *
 * @param {string} source isi schema.ts
 * @returns {Array<{ table: string, tenantIdExpr: string|null, hasTenantId: boolean }>}
 */
export function extractTenantIdColumns(source) {
  const lines = source.split('\n');
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const decl = /^export const \w+ = pgTable\(/.exec(lines[i]);
    if (!decl) continue;

    // Nama tabel boleh di baris yang sama atau di baris berikutnya.
    let table = null;
    const sameLine = /pgTable\(\s*'([^']+)'/.exec(lines[i]);
    if (sameLine) table = sameLine[1];
    else {
      const next = /^\s*'([^']+)'/.exec(lines[i + 1] ?? '');
      if (next) table = next[1];
    }
    if (!table) continue;

    // Baris kolom berindeks 4 spasi di dalam `pgTable(\n  'nama',\n  {`.
    const colRe = /^ {4}tenantId: uuid\('tenant_id'\)(.*)$/;
    let tenantIdExpr = null;

    for (let j = i + 1; j < lines.length; j++) {
      if (/^\);/.test(lines[j])) break;

      const m = colRe.exec(lines[j]);
      if (m) {
        // `.references()` boleh di baris ini atau di baris-baris lanjutan,
        // sampai properti kolom berikutnya pada indentasi yang sama.
        let expr = m[1];
        for (let k = j + 1; k < lines.length; k++) {
          if (/^ {4}\w+:/.test(lines[k])) break;
          expr += ' ' + lines[k].trim();
        }
        tenantIdExpr = expr;
        break;
      }
    }

    out.push({ table, tenantIdExpr, hasTenantId: tenantIdExpr !== null });
  }

  return out;
}

/**
 * @returns Array pesan kegagalan; kosong berarti semua `tenant_id` punya FK.
 */
export function checkTenantForeignKeys(source) {
  const failures = [];
  const tables = extractTenantIdColumns(source);
  let withTenantId = 0;

  for (const { table, tenantIdExpr, hasTenantId } of tables) {
    if (!hasTenantId) continue;
    withTenantId += 1;
    if (!tenantIdExpr.includes('.references(')) {
      failures.push(
        `${table}.tenant_id tidak punya foreign key ke tenants — RLS hanya bisa ` +
          'membandingkan nilainya, tidak bisa memverifikasinya benar',
      );
    }
  }

  if (withTenantId === 0) {
    // Parser bisa saja salah baca. Di file asli ini kondisi itu berarti
    // penjaga tidak melihat apa pun, jadi harus gagal keras -- tapi penempatannya
    // di `main()`, bukan di sini, supaya fungsi ini tetap bisa diuji dengan
    // potongan skema yang sengaja tidak punya `tenant_id`.
  }

  return failures;
}

function selfTest(verbose) {
  const cases = [
    [
      'inline references harus LOLOS',
      `export const a = pgTable('a', {\n    tenantId: uuid('tenant_id').references(() => tenants.id),\n  },\n);`,
      true,
    ],
    [
      'references di baris lanjutan harus LOLOS',
      `export const b = pgTable(\n  'b',\n  {\n    tenantId: uuid('tenant_id')\n      .notNull()\n      .references(() => tenants.id),\n    name: text('name'),\n  },\n);`,
      true,
    ],
    [
      'tanpa references harus TERTANGKAP',
      `export const c = pgTable('c', {\n    tenantId: uuid('tenant_id').notNull(),\n  },\n);`,
      false,
    ],
    [
      'tabel tanpa tenant_id diabaikan',
      `export const d = pgTable('d', {\n    id: uuid('id'),\n  },\n);`,
      true,
    ],
  ];

  let broken = 0;
  if (verbose) process.stdout.write('Guard 4 -- uji mandiri:\n');
  for (const [label, source, shouldPass] of cases) {
    const passed = checkTenantForeignKeys(source).length === 0;
    const correct = passed === shouldPass;
    if (!correct) broken += 1;
    if (verbose) process.stdout.write(`  ${correct ? 'benar ' : 'SALAH'}  ${label}\n`);
  }

  if (broken > 0) {
    process.stderr.write(
      `\nGAGAL: guard tidak dapat dipercaya. ${broken} dari ${cases.length} kasus uji mandiri punya verdict terbalik.\n`,
    );
    return false;
  }
  return true;
}

function main() {
  if (!statSync(SCHEMA_PATH, { throwIfNoEntry: false })) {
    process.stderr.write(`GAGAL: ${path.relative(root, SCHEMA_PATH)} tidak ada.\n`);
    process.exit(1);
  }

  const selfTestOnly = process.argv.includes('--self-test');
  if (!selfTest(selfTestOnly)) process.exit(1);
  if (selfTestOnly) process.exit(0);

  const failures = checkTenantForeignKeys(readFileSync(SCHEMA_PATH, 'utf8'));
  const tenantIdCount = extractTenantIdColumns(readFileSync(SCHEMA_PATH, 'utf8')).filter(
    (t) => t.hasTenantId,
  ).length;

  if (tenantIdCount === 0) {
    process.stderr.write(
      `GAGAL: tidak ada kolom tenant_id yang terdeteksi di ${path.relative(root, SCHEMA_PATH)}. ` +
        'Parser guard ini tidak lagi cocok dengan bentuk deklarasi schema.\n',
    );
    process.exit(1);
  }

  if (failures.length > 0) {
    process.stderr.write(
      'GAGAL: ada kolom tenant_id tanpa foreign key ke tenants. RLS membandingkan tenant_id ' +
        'ke app.current_tenant_id(); kalau nilainya sendiri salah, tidak ada lapisan yang ' +
        'menangkapnya.\n\n',
    );
    for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
    process.exit(1);
  }

  process.stdout.write(
    `Paritas tenant_id terjaga: ${tenantIdCount} kolom tenant_id, semuanya punya foreign key ke tenants.\n`,
  );
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
