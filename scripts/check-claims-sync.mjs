import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const claimsPath = path.join(root, 'packages', 'auth', 'src', 'claims.ts');
const sharedAuthPath = path.join(root, 'packages', 'shared', 'src', 'auth.ts');
const seedPath = path.join(root, 'scripts', 'seed-firebase-claims.mts');
const deployPath = path.join(root, '.github', 'workflows', 'claims-seed.yml');
const authorizationPath = path.join(root, 'apps', 'web', 'src', 'lib', 'auth', 'authorization.ts');

/**
 * Hapus komentar baris (`// ...`) di ujung baris.
 *
 * Sengaja sederhana: tidak menangani `//` di dalam string literal karena dua
 * berkas yang dijaga tidak memuat pola tersebut.
 */
function stripLineComment(line) {
  const idx = line.indexOf('//');
  return idx === -1 ? line : line.slice(0, idx);
}

/** Baca berkas; gagal dengan pesan jelas alih-alih mencetak stack trace mentah. */
function readFileOrFail(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    const rel = path.relative(root, filePath) || filePath;
    console.error(`GAGAL: tidak bisa membaca ${rel} (${error.code ?? error.message})`);
    process.exit(1);
  }
}

/**
 * Temukan deklarasi Zod bernama `declarationName` (mis. `z.object({ ... })`)
 * lalu kumpulkan key properti top-level saja.
 *
 * Penelusuran baris demi baris dengan pelacakan kedalaman kurung kurawal, agar:
 * - deklarasi boleh terformat multi-baris (`{` tidak harus sebaris `z.object(`,
 *   bahkan `z.object(` sendiri boleh terpecah antar baris);
 * - objek bersarang (mis. `superRefine`) tidak ikut menyumbang key.
 *
 * Deklarasi dianggap ada bila namanya dideklarasikan; pencarian `{` dimulai
 * setelah nama deklarasi ditemukan.
 */
function objectKeys(source, declarationName) {
  const lines = source.split('\n');
  const declaration = new RegExp(`(?:const|let|var)\\s+${declarationName}\\s*=`);
  const keyPattern = /^\s*([A-Za-z_$][\w$]*)\s*:/;

  let started = false;
  let opened = false;
  let depth = 0;
  const keys = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = stripLineComment(lines[i]);

    if (!started && !declaration.test(line)) continue;
    started = true;

    const keyMatch = line.match(keyPattern);
    if (opened && depth === 1 && keyMatch) {
      keys.push(keyMatch[1]);
    }

    for (const ch of line) {
      if (ch === '{') {
        depth += 1;
        opened = true;
      } else if (ch === '}') {
        depth -= 1;
      }
    }

    if (opened && depth === 0) return { found: true, keys };
  }

  // Deklarasi ada tetapi kurung kurawal tidak pernah menutup: anggap gagal.
  return { found: false, keys };
}

/** Nama yang diharapkan tetapi tidak ada di `actual`. */
function missingKeys(actual, expected) {
  return expected.filter((name) => !actual.includes(name));
}

function main() {
  const sharedSource = readFileOrFail(sharedAuthPath);
  const claimsSource = readFileOrFail(claimsPath);

  const shared = objectKeys(sharedSource, 'customClaimsSchema');
  const token = objectKeys(claimsSource, 'firebaseClaimsSchema');

  const failures = [];

  if (!shared.found) {
    failures.push(`customClaimsSchema tidak ditemukan di ${path.relative(root, sharedAuthPath)}.`);
  }
  if (!token.found) {
    failures.push(`firebaseClaimsSchema tidak ditemukan di ${path.relative(root, claimsPath)}.`);
  }

  // Nama klaim bentuk token (snake_case, wire).
  const tokenNames = ['role', 'app_role', 'tenant_id', 'parent_tenant_id'];
  // Nama klaim bentuk aplikasi (camelCase).
  const sharedNames = ['role', 'appRole', 'tenantId', 'parentTenantId'];

  if (token.found) {
    for (const name of missingKeys(token.keys, tokenNames)) {
      failures.push(`klaim token "${name}" hilang dari firebaseClaimsSchema.`);
    }
  }

  if (shared.found) {
    for (const name of missingKeys(shared.keys, sharedNames)) {
      failures.push(`klaim aplikasi "${name}" hilang dari customClaimsSchema.`);
    }
  }

  /*
   * Pasangan prefix snake_case <-> camelCase harus muncul bersama. `role` tidak
   * dipasangkan karena ejaannya sama di kedua sisi. Key tambahan di salah satu
   * skema TIDAK dianggap gagal: skema boleh tumbuh, hanya subset bersama yang
   * bersifat kontrak.
   */
  const pairs = [
    ['app_role', 'appRole'],
    ['tenant_id', 'tenantId'],
    ['parent_tenant_id', 'parentTenantId'],
  ];

  if (token.found && shared.found) {
    for (const [snake, camel] of pairs) {
      const inToken = token.keys.includes(snake);
      const inShared = shared.keys.includes(camel);
      if (inToken && !inShared) {
        failures.push(
          `"${snake}" ada di firebaseClaimsSchema tetapi "${camel}" tidak ada di customClaimsSchema.`,
        );
      }
      if (!inToken && inShared) {
        failures.push(
          `"${camel}" ada di customClaimsSchema tetapi "${snake}" tidak ada di firebaseClaimsSchema.`,
        );
      }
    }
  }

  /*
   * Penutupan kelas outage D-14 (ADR-007). `CLAIMS_STALE`/`CLAIMS_INVALID`
   * menolak SETIAPA akun yang claim-nya tidak cocok dengan baris `users`, jadi
   * claim harus selalu bisa diregenerasi dari DB. Empat hal di bawah adalah
   * yang membuat itu mungkin; hilangkan satu saja dan outage Owner/CEO bisa
   * kembali tanpa ada yang menyadarinya.
   */
  const seed = readFileOrFail(seedPath);
  for (const needle of [
    'buildCustomClaims',
    'setUserClaims',
    'toCustomClaims',
    'CLAIMS_STALE',
    'CLAIMS_INVALID',
    'CLAIMS_MISSING',
  ]) {
    if (!seed.includes(needle)) {
      failures.push(
        `skrip seeding tidak lagi menyebut ${needle}; regenerasi claim dari DB bisa rusak.`,
      );
    }
  }

  const authorization = readFileOrFail(authorizationPath);
  if (!/throw new AuthorizationError\('CLAIMS_STALE'/.test(authorization)) {
    failures.push('CLAIMS_STALE bukan lagi hard failure di authorization.ts.');
  }
  if (!/throw new AuthorizationError\('CLAIMS_INVALID'/.test(authorization)) {
    failures.push('CLAIMS_INVALID bukan lagi hard failure di authorization.ts.');
  }

  // Claim tidak boleh pernah dibangun inline di luar `buildCustomClaims`.
  const setClaimCallers = readdirSync(path.join(root, 'apps', 'web', 'src'), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => readFileSync(path.join(entry.parentPath, entry.name), 'utf8'))
    .filter((source) => source.includes('setUserClaims('));

  for (const source of setClaimCallers) {
    if (!source.includes('buildCustomClaims(')) {
      failures.push('ada call site setUserClaims yang tidak lewat buildCustomClaims.');
      break;
    }
  }

  const deploy = readFileOrFail(deployPath);
  if (!deploy.includes('pnpm seed:claims')) {
    failures.push('workflow seeding tidak menjalankan "pnpm seed:claims".');
  }

  if (failures.length > 0) {
    for (const f of failures) console.error(`GAGAL: ${f}`);
    process.exit(1);
  }

  console.log(
    `OK: ${tokenNames.length} klaim sinkron antara firebaseClaimsSchema dan customClaimsSchema.`,
  );
  console.log(`    ${tokenNames.join(', ')}`);
  console.log('OK: seeding claim ada, idempoten, dan dipanggil pipeline deploy.');
}

main();
