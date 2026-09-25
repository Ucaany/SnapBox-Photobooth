/**
 * Guard Feature Entitlement (PRD Bab 11, Task 1.7).
 *
 * DILARANG mengecek kemampuan plan dengan membandingkan nama tier, mis.
 * `plan === 'GROWTH'` atau `tenant.planTier !== 'STARTER'`. Semua keputusan
 * fitur wajib lewat `checkEntitlement` (memakai `plans.features`).
 *
 * Yang BOLEH membandingkan tier adalah kode yang memang bekerja dengan
 * perpindahan plan, bukan capability:
 *   - editor plan (daftar/urutan/penyimpanan tier);
 *   - provisioning & downgrade (validasi plan tujuan);
 *   - label/tampilan dan seed data.
 * Berkas di `ALLOWED_PATHS` karena itu dikecualikan, dan setiap pola baru
 * harus dijelaskan alasan bisnisnya agar tidak jadi celah diam-diam.
 *
 * Jalankan: `node scripts/check-entitlement-usage.mjs`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Direktori sumber yang dipindai. */
const SOURCE_DIRS = ['apps/web/src', 'packages'];

/** Ekstensi sumber yang relevan. */
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

/**
 * Berkas yang boleh menyebut nama tier untuk keperluan perpindahan plan,
 * label, atau seed. Setiap entri diberi alasan singkat.
 */
const ALLOWED_PATHS = new Map([
  // Editor plan: mengelola daftar/urutan/penyimpanan tier.
  ['apps/web/src/lib/ceo-dashboard/plan-contract.ts', 'editor plan'],
  ['apps/web/src/lib/ceo-dashboard/plan-server.ts', 'editor plan'],
  ['apps/web/src/lib/ceo-dashboard/plan-contract.test.mjs', 'test editor plan'],
  // Provisioning & downgrade: plan tujuan, bukan capability.
  ['apps/web/src/lib/ceo-dashboard/tenant-contract.ts', 'provisioning/downgrade'],
  ['apps/web/src/lib/ceo-dashboard/tenant-server.ts', 'provisioning/downgrade'],
  ['apps/web/src/app/(ceo-dashboard)/ceo-dashboard/tenants/actions.ts', 'provisioning/downgrade'],
  [
    'apps/web/src/app/(ceo-dashboard)/ceo-dashboard/tenants/[id]/tenant-detail-actions.tsx',
    'downgrade',
  ],
  // Tampilan/label tier, bukan capability.
  ['apps/web/src/lib/ceo-dashboard/subscription-contract.ts', 'label invoice'],
  ['apps/web/src/lib/ceo-dashboard/subscription-server.ts', 'label invoice'],
  ['apps/web/src/lib/ceo-dashboard/subscription-contract.test.mjs', 'test label'],
  // Sumber enum tier.
  ['packages/shared/src/domain.ts', 'sumber enum'],
  ['packages/db/src/schema.ts', 'skema'],
  ['packages/db/src/seed.ts', 'seed data'],
]);

/**
 * Pola yang menandakan tier dipakai sebagai CAPABILITY, bukan perpindahan.
 *
 * Hanya bentuk perbandingan/percabangan yang ditangkap; penyebutan tier di
 * tipe, label, atau data tidak.
 */
const FORBIDDEN_PATTERNS = [
  /\b(?:plan|planTier|tier)\s*[!=]==?\s*['"](?:STARTER|GROWTH|ENTERPRISE)['"]/,
  /['"](?:STARTER|GROWTH|ENTERPRISE)['"]\s*[!=]==?\s*\b(?:plan|planTier|tier)\b/,
  /\b(?:plan|planTier|tier)\b\s*\.(?:includes|startsWith|endsWith)\s*\(/,
];

const IGNORED_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'build', 'target']);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full, files);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

function stripLineComment(line) {
  const idx = line.indexOf('//');
  return idx === -1 ? line : line.slice(0, idx);
}

function main() {
  const failures = [];
  let scanned = 0;

  for (const dir of SOURCE_DIRS) {
    const abs = path.join(root, dir);
    let files;
    try {
      files = walk(abs);
    } catch (error) {
      console.error(`GAGAL: tidak bisa memindai ${dir} (${error.code ?? error.message})`);
      process.exit(1);
    }

    for (const file of files) {
      const rel = path.relative(root, file).split(path.sep).join('/');
      scanned += 1;
      if (ALLOWED_PATHS.has(rel)) continue;

      const source = readFileSync(file, 'utf8');
      const lines = source.split('\n');

      lines.forEach((rawLine, index) => {
        const line = stripLineComment(rawLine);
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) {
            failures.push(
              `${rel}:${index + 1} membandingkan tier sebagai capability. Gunakan checkEntitlement().`,
            );
            break;
          }
        }
      });
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`GAGAL: ${failure}`);
    process.exit(1);
  }

  console.log(
    `OK: ${scanned} berkas sumber tidak memakai perbandingan tier sebagai capability (kecuali ${ALLOWED_PATHS.size} pengecualian terdokumentasi).`,
  );
}

main();
