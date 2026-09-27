import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

/**
 * GUARD 3 — paritas berkas migrasi dengan `meta/_journal.json`.
 *
 * APA YANG DIGAGAK. Migrator Drizzle HANYA menjalankan entri yang ada di
 * journal. Berkas `.sql` yang ada di `migrations/` tanpa entry journal tidak
 * menghasilkan error, tidak menghasilkan warning, dan tidak pernah dieksekusi
 * di database mana pun — ia hanya diam.
 *
 * Itu persis yang terjadi pada `0005_owner_promo_code_scope.sql` (BE-020, P0):
 * berkasnya ada dan ter-commit, tapi tidak pernah dijalankan, jadi index
 * `promo_redemptions_tenant_customer_idx` yang di dalamnya tidak pernah ada di
 * database mana pun. Migration tidak pernah "gagal separuh" — ia tidak pernah
 * jalan sama sekali, dan tidak ada yang mengetahuinya.
 *
 * ARAH KEGAGALAN. Keduanya digagalkan, bukan hanya berkas yatim:
 *   - berkas di disk tanpa entry journal  -> tidak akan pernah dieksekusi;
 *   - entry journal tanpa berkas di disk  -> migration dijalankan, tidak ada apa
 *     yang dirollback, dan `drizzle-kit` akan gagal saat generate berikutnya.
 *
 * SNAPSHOT. `meta/NNNN_snapshot.json` juga diperiksa: snapshot dengan idx yang
 * tidak punya migration adalah sisa generator, dan hilang begitu saja di
 * database mana pun.
 *
 * PEMAKAIAN.
 *   node scripts/check-migration-journal.mjs            cek repo
 *   node scripts/check-migration-journal.mjs --self-test guard menguji guard
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIGRATIONS_DIR = path.join(root, 'packages/db/migrations');
const META_DIR = path.join(MIGRATIONS_DIR, 'meta');
const JOURNAL_PATH = path.join(META_DIR, '_journal.json');
const SNAPSHOT_PATTERN = /^(\d{4})_snapshot\.json$/;
const MIGRATION_PATTERN = /^(\d{4})_/;
const SQL_SUFFIX = '.sql';

/**
 * Bandingkan tag journal, tag berkas, dan idx snapshot.
 *
 * @returns Array pesan kegagalan; kosong berarti paritas terjaga.
 */
export function checkParity({ entries, migrationFiles, snapshotFiles }) {
  const failures = [];
  const journalTags = new Map();

  for (const entry of entries) {
    if (typeof entry.tag !== 'string' || !Number.isInteger(entry.idx)) {
      failures.push(`entri journal tidak berbentuk { idx, tag }: ${JSON.stringify(entry)}`);
      continue;
    }
    if (journalTags.has(entry.tag)) {
      failures.push(`tag journal duplikat: ${entry.tag} (migrator akan menjalankan dua kali)`);
    }
    journalTags.set(entry.tag, entry.idx);
  }

  const fileTags = new Set(migrationFiles.map((name) => name.slice(0, -SQL_SUFFIX.length)));

  for (const tag of fileTags) {
    if (!journalTags.has(tag)) {
      failures.push(
        `berkas ${tag}${SQL_SUFFIX} tidak punya entry di _journal.json — migrator tidak ` +
          'akan pernah menjalankannya',
      );
    }
  }

  for (const [tag, idx] of journalTags) {
    if (!fileTags.has(tag)) {
      failures.push(
        `entry journal ${tag} (idx ${idx}) tidak punya berkas .sql — migration akan ` +
          'dijalankan tanpa apa yang bisa di-rollback',
      );
    }
  }

  // Prefiks numerik harus unik. Dua berkas berbagi satu prefix membuat urutan
  // eksekusi ambigu, dan itulah yang membuat berkas yatim 0005 sulit terlihat.
  const byPrefix = new Map();
  for (const tag of fileTags) {
    const match = MIGRATION_PATTERN.exec(tag);
    if (!match) {
      failures.push(`nama migrasi tidak diawali empat digit: ${tag}${SQL_SUFFIX}`);
      continue;
    }
    byPrefix.set(match[1], [...(byPrefix.get(match[1]) ?? []), tag]);
  }
  for (const [prefix, tags] of byPrefix) {
    if (tags.length > 1) {
      failures.push(`prefix ${prefix} dipakai ${tags.length} berkas: ${tags.join(', ')}`);
    }
  }

  const snapshotIdx = new Set();
  for (const name of snapshotFiles) {
    const match = SNAPSHOT_PATTERN.exec(name);
    if (!match) {
      failures.push(`nama snapshot tidak mengikuti <idx>_snapshot.json: ${name}`);
      continue;
    }
    snapshotIdx.add(match[1]);
  }
  for (const prefix of snapshotIdx) {
    const owner = [...fileTags].find((tag) => tag.startsWith(`${prefix}_`));
    if (!owner) {
      failures.push(`meta/${prefix}_snapshot.json tidak punya migration dengan prefix ${prefix}`);
    }
  }

  // `when` harus NAIK MONOTON. Migrator Drizzle menjalankan entri yang `when`-nya
  // lebih besar dari `created_at` terakhir di `drizzle.__drizzle_migrations`, jadi
  // urutan nomor idx dan urutan waktu harus sepakat. Dua kegagalan nyata muncul dari
  // pemateluan ini:
  //   - nilai `when` disunting manual jadi tidak naik (entri baru dilewati diam);
  //   - `drizzle-kit generate` menulis ulang `when` sehingga entri yang baru
  //     dibuat justru lebih tua dari entri yang sudah tercatat di database.
  // Keduanya berakhir sama: migration tidak pernah jalan, tanpa error.
  const sorted = [...entries].sort((a, b) => a.idx - b.idx);
  for (let i = 1; i < sorted.length; i++) {
    if (!(sorted[i].when > sorted[i - 1].when)) {
      failures.push(
        `entri journal ${sorted[i].tag} (idx ${sorted[i].idx}) punya when=${sorted[i].when} yang ` +
          `tidak lebih besar dari ${sorted[i - 1].tag} (when=${sorted[i - 1].when}); migrator akan ` +
          'melewatinya diam-diam',
      );
    }
  }

  return failures;
}

function selfTest(verbose) {
  const good = {
    entries: [
      { idx: 0, tag: '0000_init', when: 1790489216000 },
      { idx: 1, tag: '0001_rls', when: 1790489216001 },
    ],
    migrationFiles: ['0000_init.sql', '0001_rls.sql'],
    snapshotFiles: ['0000_snapshot.json'],
  };
  // Orfa: persis bentuk BE-020.
  const orphaned = {
    ...good,
    migrationFiles: [...good.migrationFiles, '0002_promo_scope.sql'],
  };
  // Entry journal tanpa berkas.
  const danglingEntry = {
    ...good,
    entries: [...good.entries, { idx: 2, tag: '0002_hilang', when: 1790489216002 }],
  };
  // Dua berkas satu prefix.
  const duplicatePrefix = {
    ...good,
    migrationFiles: [...good.migrationFiles, '0001_lain.sql'],
  };
  // `when` tidak naik: entri kedua dilewati diam-diam oleh migrator.
  const nonMonotonic = {
    entries: [
      { idx: 0, tag: '0000_init', when: 1790489216001 },
      { idx: 1, tag: '0001_rls', when: 1790489216000 },
    ],
    migrationFiles: ['0000_init.sql', '0001_rls.sql'],
    snapshotFiles: ['0000_snapshot.json'],
  };

  const cases = [
    ['input baik harus LOLOS', good, true],
    ['berkas yatim harus TERTANGKAP', orphaned, false],
    ['entry journal tanpa berkas harus TERTANGKAP', danglingEntry, false],
    ['prefix ganda harus TERTANGKAP', duplicatePrefix, false],
    ['when tidak naik monoton harus TERTANGKAP', nonMonotonic, false],
  ];

  let broken = 0;
  if (verbose) process.stdout.write('Guard 3 -- uji mandiri:\n');
  for (const [label, input, shouldPass] of cases) {
    const passed = checkParity(input).length === 0;
    const correct = passed === shouldPass;
    if (!correct) broken += 1;
    if (verbose) {
      process.stdout.write(`  ${correct ? 'benar ' : 'SALAH'}  ${label}\n`);
    }
  }

  if (broken > 0) {
    process.stderr.write(
      `\nGAGAL: guard tidak dapat dipercaya. ${broken} dari ${cases.length} kasus uji mandiri ` +
        'punya verdict yang terbalik.\n',
    );
    return false;
  }
  return true;
}

/**
 * Bandingkan journal repo dengan `drizzle.__drizzle_migrations` di database nyata.
 *
 * KONDISI YANG DICARI. Migrator menjalankan entri yang `when` > max(created_at)
 * yang sudah tercatat. Kalau max(created_at) di database LEBIH BESAR dari max
 * `when` di journal, maka tidak ada entri yang akan pernah dijalankan lagi --
 * `drizzle-kit migrate` keluar dengan "migrations applied successfully" tanpa
 * menjalankan apa pun. Itu kondisi yang benar-benar terjadi di environment ini:
 * satu baris `created_at=1790516100000` tercatat,~7,5 jam di MASA DEPAN
 * dibanding jam mesin, sehingga setiap migration baru dilewati diam-diam.
 *
 * Tidak bisa dijaga secara statis, jadi mode opt-in yang butuh kredensial.
 */
async function checkApplied(url) {
  // `postgres` adalah dependency `@snapbox/db`, bukan dependency root, jadi
  // di-resolve lewat `createRequire` yang di-anchor ke package itu. Cara ini
  // menjauh dari menjalankan guard statis (yang tidak butuh koneksi sama sekali)
  // tanpa menambah dependency baru di root.
  const { createRequire } = await import('node:module');
  const require = createRequire(path.join(root, 'packages/db/package.json'));
  const postgres = require('postgres');

  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15, idle_timeout: 5 });
  try {
    const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'));
    const journalMax = Math.max(...journal.entries.map((e) => e.when));
    const rows = await sql.unsafe(
      'select max(created_at)::bigint as max_applied from drizzle.__drizzle_migrations',
    );
    const appliedMax = Number(rows[0]?.max_applied ?? 0);

    // `==` adalah kondisi sehat: entri terakhir memang sudah berlaku, tidak
    // ada yang tertinggal. Yang rusak adalah database lebih MAJU dari journal,
    // karena entri yang tersisa tidak akan pernah dievaluasi.
    if (appliedMax > journalMax) {
      process.stderr.write(
        `GAGAL: database sudah mencatat migration sampai created_at=${appliedMax}, sementara journal ` +
          'repo hanya sampai when=' +
          journalMax +
          '.\n' +
          '  Migrator akan melewati SEMUA entri journal tanpa error. Perbaiki dengan ' +
          'menyesuaikan `drizzle.__drizzle_migrations` ke journal (id = idx + 1), lalu jalankan ' +
          'ulang `drizzle-kit migrate`. Baris yang tidak punya pasangan di journal adalah sisa ' +
          'migration yang pernah dijalankan di luar jalur journal.\n',
      );
      return false;
    }

    const pending = journal.entries.filter((e) => e.when > appliedMax).length;
    process.stdout.write(
      `Bookkeeping sinkron: journal max when=${journalMax}, database max created_at=${appliedMax}. ` +
        `${pending} entri menunggu dijalankan.\n`,
    );
    return true;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  if (!statSync(MIGRATIONS_DIR, { throwIfNoEntry: false })) {
    process.stderr.write(`GAGAL: ${path.relative(root, MIGRATIONS_DIR)} tidak ada.\n`);
    process.exit(1);
  }

  const selfTestOnly = process.argv.includes('--self-test');
  if (!selfTest(selfTestOnly)) process.exit(1);
  if (selfTestOnly) process.exit(0);

  if (process.argv.includes('--check-applied')) {
    const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
    if (!url) {
      process.stderr.write('GAGAL: --check-applied butuh DIRECT_URL atau DATABASE_URL.\n');
      process.exit(1);
    }
    process.exit((await checkApplied(url)) ? 0 : 1);
  }

  const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'));
  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(SQL_SUFFIX))
    .sort();
  // `_journal.json` memang tinggal di meta/ dan bukan snapshot, jadi dikeluarkan
  // di sini. Berkas lain yang tidak dikenal TIDAP dikeluarkan: checkParity
  // akan melaporkannya, dan itulah gunanya.
  const snapshotFiles = readdirSync(META_DIR)
    .filter((name) => name !== '_journal.json')
    .sort();

  const failures = checkParity({ entries: journal.entries, migrationFiles, snapshotFiles });

  if (failures.length > 0) {
    process.stderr.write(
      'GAGAL: paritas migrasi dan journal rusak. Migrator Drizzle hanya menjalankan ' +
        'entri journal, jadi berkas yatim tidak akan pernah dieksekusi dan tidak akan ' +
        'pernah memberi error.\n\n',
    );
    for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
    process.stderr.write(
      '\nJiplah fail 0005_owner_promo_code_scope.sql sebagai contoh nyata: berkasnya ada, ' +
        'entri journal-nya tidak.\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    `Paritas migrasi terjaga: ${migrationFiles.length} berkas .sql, ` +
      `${journal.entries.length} entry journal, ${snapshotFiles.length} berkas meta — semua ` +
      'padanan, tidak ada berkas yatim, tidak ada entry menggantung, tidak ada prefix ganda.\n',
  );
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
