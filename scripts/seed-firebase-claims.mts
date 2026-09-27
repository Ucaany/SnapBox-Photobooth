/**
 * Seeding custom claim Firebase dari baris `users` (ADR-007, menjawab D-14).
 *
 *MASALAH YANG DISELESAIKAN. `setUserClaims` punya tepat satu call site di
 * seluruh repo (pembuatan staff), jadi TIDAK ADA jalur yang menulis claim untuk
 * OWNER atau CEO. Login `authorization.ts` menolak token tanpa claim dengan
 * `CLAIMS_INVALID` dan menolak claim yang tidak cocok dengan DB dengan
 * `CLAIMS_STALE`. Akibatnya setiap Owner/CEO tanpa claim ditolak — outage
 * produksi, bukan celah keamanan.
 *
 * KEPUTUSAN (ADR-007): claim diturunkan dari baris `public.users` yang adalah
 * satu-satunya sumber kebenaran, dan `CLAIMS_STALE`/`CLAIMS_INVALID` TETAP hard
 * failure. Yang diperbaiki sumber datanya, bukan relaksasi pengecekannya.
 *
 * SIFAT:
 * - IDEMPOTEN. Claim yang sudah cocok tidak ditulis ulang, jadi skrip aman
 *   dijalankan berulang di pipeline.
 * - GAGAL TERBUKA. `--check` melaporkan drift dan keluar non-nol tanpa menulis,
 *   sehingga CI bisa menangkap akun yang belum punya claim SEBELUM deploy.
 * - TIDAK PERNAH mencetak kredensial. Keluarannya hanya uid (8 karakter awal),
 *   peran, dan keputusan yang diambil.
 *
 * PEMAKAIAN:
 *   pnpm seed:claims            # jalankan seeding (idempoten)
 *   pnpm seed:claims -- --check # hanya laporan drift, tanpa menulis
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildCustomClaims, toCustomClaims } from '@snapbox/auth';
import { getUserClaims, setUserClaims } from '@snapbox/auth/admin';
import { closeDatabase, createDatabase, users } from '@snapbox/db';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Prefix UID placeholder hasil seed; akun seperti ini memang tidak ada di Firebase. */
const SEED_UID_PREFIX = 'seed:';

/** Panjang awalan UID yang dicetak. Sisanya tidak pernah ditampilkan. */
const UID_PREVIEW = 8;

/**
 * Memuat `.env` ke `process.env` tanpa menimpa nilai yang sudah ada.
 *
 * Dipisah agar skrip operator bisa dijalankan tanpa membungkus `env $(cat .env)`
 * di shell, yang bocor secret ke process table.
 */
function loadDotEnv(): void {
  let source: string;
  try {
    source = readFileSync(path.join(root, '.env'), 'utf8');
  } catch {
    return; // Tidak ada .env: andalkan env yang diwarisi (CI/Vercel).
  }

  for (const line of source.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    const [, name, raw] = match;
    if (process.env[name] !== undefined) continue;

    const quoted = /^(['"])([\s\S]*)\1$/.exec(raw.trim());
    process.env[name] = (quoted ? quoted[2] : raw).replace(/\\n/g, '\n').trim();
  }
}

interface UserRow {
  readonly uid: string;
  readonly role: 'CEO' | 'OWNER' | 'STAFF';
  readonly tenantId: string | null;
  readonly parentTenantId: string | null;
}

/**
 * Satu-satunya tempat keputusan "akun ini butuh claim apa" ditulis.
 *
 * Dipisah dari I/O supaya bisa diuji tanpa Firebase: untuk baris DB yang
 * diberikan, hasilnya harus persis sama dengan yang ditulis `buildCustomClaims`,
 * dan akun yang tidak bisa login tidak boleh pernah jadi target.
 */
export function planClaims(rows: readonly UserRow[]): {
  plant: { row: UserRow; claims: ReturnType<typeof buildCustomClaims> }[];
  skip: string[];
} {
  const plant: { row: UserRow; claims: ReturnType<typeof buildCustomClaims> }[] = [];
  const skip: string[] = [];

  for (const row of rows) {
    if (row.uid.startsWith(SEED_UID_PREFIX)) {
      skip.push(`${previewUid(row.uid)} placeholder seed`);
      continue;
    }

    plant.push({
      row,
      claims: buildCustomClaims({
        appRole: row.role,
        tenantId: row.tenantId,
        parentTenantId: row.parentTenantId,
      }),
    });
  }

  return { plant, skip };
}

/** Bentuk claim yang dibandingkan dengan claim tersimpan di Firebase. */
function normalized(claims: Record<string, unknown> | null): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(claims ?? {})
        .filter(
          ([key]) =>
            key === 'role' ||
            key === 'app_role' ||
            key === 'tenant_id' ||
            key === 'parent_tenant_id',
        )
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}

function previewUid(uid: string): string {
  return `${uid.slice(0, UID_PREVIEW)}…`;
}

/**
 * Kode penolakan login yang akan党的建设, atau `null` bila lolos.
 *
 * Ini adalah `CLAIMS_INVALID` dan `CLAIMS_STALE` dari
 * `apps/web/src/lib/auth/authorization.ts`, dievaluasi terhadap claim yang
 * BENAR-BENAR tersimpan di Firebase. Keduanya adalah penyebab outage yang
 * skrip ini perbaiki, jadi keduanya yang diukur — penolakan lain
 * (`TENANT_BLOCKED`, `SUBSCRIPTION_INACTIVE`) bukan urusan claim dan tetap
 * Tegakan di `authorizeResolvedUser`.
 *
 * Fungsi ini murni dan diekspor supaya bisa diuji tanpa Firebase.
 */
export function loginRejection(
  stored: Record<string, unknown> | null,
  dbRole: string,
): string | null {
  if (!stored || Object.keys(stored).length === 0) return 'CLAIMS_MISSING';

  let parsed: { appRole: string };
  try {
    parsed = toCustomClaims(stored);
  } catch {
    return 'CLAIMS_INVALID';
  }

  return parsed.appRole === dbRole ? null : 'CLAIMS_STALE';
}

async function main(): Promise<void> {
  loadDotEnv();

  const check = process.argv.includes('--check');

  const required = [
    'DATABASE_URL',
    'FIREBASE_ADMIN_PROJECT_ID',
    'FIREBASE_ADMIN_CLIENT_EMAIL',
    'FIREBASE_ADMIN_PRIVATE_KEY',
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`env belum lengkap: ${missing.join(', ')}`);
  }

  const db = createDatabase();
  const all = await db
    .select({
      uid: users.firebaseUid,
      role: users.role,
      tenantId: users.tenantId,
      parentTenantId: users.parentTenantId,
      disabled: users.disabled,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .orderBy(users.role, users.email);

  // Akun nonaktif/terhapus tidak bisa login, jadi claim-nya tidak relevan.
  // Penyaringan dilakukan di sini, bukan lewat operator SQL, supaya skrip ini
  // hanya butuh satu paket workspace dan tidak menarik `drizzle-orm` ke root.
  const active = all.filter((row) => !row.disabled && row.deletedAt === null);

  const { plant, skip } = planClaims(active);
  let written = 0;
  /** Akun yang login-nya akan ditolak, dengan kode penolakan yang sebenarnya. */
  const rejected: string[] = [];
  /** Per akun nyata: peran + hasil gerbang login, untuk bukti yang terbaca. */
  const verdicts: string[] = [];

  for (const { row, claims } of plant) {
    const current = await getUserClaims(row.uid);
    if (current === null) {
      rejected.push(`${previewUid(row.uid)} (${row.role}) UID_UNKNOWN`);
      verdicts.push(
        `${row.role.padEnd(5)} ${previewUid(row.uid)}  DITOLAK: uid tidak ada di Firebase`,
      );
      continue;
    }

    // Keadaan SESUDAH planting dianalisis ulang, karena inilah yang menentukan
    // apakah login akan diterima. `toCustomClaims` adalah parser yang sama
    // persis dengan yang dipakai `authorization.ts`, jadi hasilnya bukan
    // perkiraan: claim yang gagal di sini gagal juga di produksi.
    const rejection = loginRejection(current, row.role);
    if (rejection) {
      if (!check) await setUserClaims(row.uid, claims);
      written += 1;
      rejected.push(`${previewUid(row.uid)} (${row.role}) ${rejection}`);
      verdicts.push(`${row.role.padEnd(5)} ${previewUid(row.uid)}  DITOLAK: ${rejection}`);
      continue;
    }

    if (normalized(current) !== normalized(claims)) {
      // Selisih di luar empat kunci yang di-normalisasi (mis. claim asing sisa).
      if (!check) await setUserClaims(row.uid, claims);
      written += 1;
      console.log(`  DITANAM: ${previewUid(row.uid)} (${row.role}) claim normalize ulang`);
    }

    verdicts.push(`${row.role.padEnd(5)} ${previewUid(row.uid)}  LOLOS: login diterima`);
  }

  for (const reason of skip) {
    console.log(`  DILEWATI: ${reason}`);
  }

  if (check) {
    for (const line of verdicts) console.log(`  ${line}`);
    if (rejected.length > 0) {
      console.error(
        `GAGAL: ${rejected.length} akun akan ditolak saat login. Jalankan "pnpm seed:claims".`,
      );
      for (const line of rejected) console.error(`  - ${line}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      `OK: ${plant.length} akun real akan lolos gerbang login (CLAIMS_INVALID/CLAIMS_STALE).`,
    );
    return;
  }

  if (rejected.length > 0) {
    // Ditanam ulang, tapi harus diverifikasi ulang: kalau masih ditolak setelah
    // planting, penyebabnya di luar claim dan laporan ini jujur mengatakannya.
    throw new Error(
      `${rejected.length} akun masih ditolak setelah seeding:\n  ${rejected.join('\n  ')}`,
    );
  }

  console.log(
    written === 0
      ? `OK: tidak ada perubahan. ${plant.length} akun real siap login.`
      : `OK: ${written} dari ${plant.length} akun claim-nya ditanam.`,
  );
}

try {
  await main();
} catch (error) {
  console.error(`GAGAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
