import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * naik dari berkas test sampai root repo, bukan dengan menghitung `..`.
 * Menghitung tingkatIMUM rapuh: memindahkan test satu folder langsung
 * menyalakannya dengan ENOENT yang tidakchezokolom explains anything.
 */
function findRepoRoot(from) {
  let current = from;
  while (current !== dirname(current)) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    current = dirname(current);
  }
  throw new Error('root repo tidak ditemukan: tidak ada pnpm-workspace.yaml di atas berkas test');
}

/**
 * Kontrak respons `/api/health` (BE-018).
 *
 * Rute ini publik, `cache: no-store`, dan tidak punya autentikasi. Dua hal yang
 * membuatnya bocor dan membuat monitor buta:
 *
 * 1. `error instanceof Error ? error.message : 'Koneksi gagal.'` dikirim ke
 *    klien. Pesan driver Postgres/Supabase bisa memuat host, port, nama user,
 *    dan nama database. Di rute publik tanpa auth, itu peta, bukan pesan.
 * 2. Route selalu membalas HTTP 200, bahkan saat database mati total. Uptime
 *    probe yang memeriksa "ada respons" tetap hijau selama tidak ada yang bisa
 *    dijangkau.
 *
 * Batas test: memeriksa sumber, bukan respons HTTP sungguhan. Menjalankannya
 * berarti membangun dan menyalakan aplikasi, dan audit tidak bisa melakukan itu
 * (AUDIT-LIM-01). Yang dijaga di sini adalah kedua cacat di atas supaya tidak
 * dikembalikan oleh penyuntingan berikutnya; pembuktian end-to-end tetap perlu
 * `curl` terhadap build yang sedang berjalan.
 */
const rootDir = findRepoRoot(join(dirname(fileURLToPath(import.meta.url))));
const read = (path) => readFileSync(join(rootDir, path), 'utf8');

const HEALTH_ROUTE = 'apps/web/src/app/api/health/route.ts';

test('pesan error driver tidak pernah masuk ke respons', () => {
  const source = read(HEALTH_ROUTE);

  assert.doesNotMatch(
    source,
    /error\s+instanceof\s+Error\s*\?\s*error\.message/,
    'pesan error mentah dikembalikan ke klien: ini kebocoran driver asli (BE-018)',
  );
  // Bentuk apa pun yang meneruskan `.message` ke hasil yang dikembalikan.
  assert.doesNotMatch(
    source,
    /detail:\s*[^,\n]*\.message/,
    '`.message` dialokasikan ke `detail`, dan `detail` ikut dikirim ke klien',
  );

  // Teks aslinya tetap boleh masuk log server; operator butuh nama host dan user.
  assert.match(
    source,
    /console\.error\([\s\S]*?error\s*\)/,
    'error mentah harus tetap dicatat server-side untuk operator',
  );
});

test('kegagalan menghasilkan status non-200', () => {
  const source = read(HEALTH_ROUTE);
  assert.match(
    source,
    /status:\s*degraded\s*\?\s*503\s*:\s*200/,
    'route harus membalas 503 saat ada dependensi yang gagal, bukan 200',
  );
  // Tidak boleh ada jalur yang mengembalikan 200 tanpaZNpa memeriksa `degraded`.
  assert.doesNotMatch(
    source,
    /NextResponse\.json\([\s\S]{0,400}?status:\s*200/,
    'ada respons health yang membalas 200 tanpa memeriksa status degraded',
  );
});

test('cache dan runtime tetap dijaga', () => {
  const source = read(HEALTH_ROUTE);
  assert.match(source, /export const runtime = 'nodejs'/);
  assert.match(source, /export const dynamic = 'force-dynamic'/);
  assert.match(source, /'cache-control': 'no-store'/);
});
