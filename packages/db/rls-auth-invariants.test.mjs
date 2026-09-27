import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Invariant `app.is_ceo()` (BE-022).
 *
 * BATAS TEST INI, DAN DIAJUI SECARA TERBUKA. Test ini memeriksa TEKS definisi
 * fungsi, bukan hasil eksekusinya. Menjalankannya berarti Postgres yang
 * sungguhan, dan lingkungan ini tidak punya satu pun (tanpa Docker, port 5432 dan
 * 54322 tertutup) — lihat AUDIT-LIM-01. Jadi yang dijaga di sini adalah
 * cabang fail-open yang PERNAH ada supaya tidak dikembalikan diam-diam oleh
 * penyuntingan berikutnya; perilaku runtime-nya masih WAJIB dibuktikan dengan
 * `select app.is_ceo()` di database nyata sebelum RLS dianggap aktif.
 */
/**
 * Naik dari berkas test sampai root repo, bukan dengan menghitung `..`.
 * Menghitung tingkat rapuh: memindahkan test satu folder langsung menyalakannya
 * dengan ENOENT yang tidak menjelaskan apa pun.
 */
function findRepoRoot(from) {
  let current = from;
  while (current !== dirname(current)) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    current = dirname(current);
  }
  throw new Error('root repo tidak ditemukan: tidak ada pnpm-workspace.yaml di atas berkas test');
}

const rootDir = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(rootDir, path), 'utf8');

const FOUNDATION = 'supabase/migrations/20260101000100_rls_foundation.sql';
const RLS_AND_REALTIME = 'packages/db/migrations/0001_rls_and_realtime.sql';

/** Badan fungsi `app.is_ceo()` saja, dari `create or replace` sampai `$$;`. */
function isCeoBody(sql) {
  const start = sql.indexOf('create or replace function app.is_ceo()');
  assert.notEqual(start, -1, 'app.is_ceo() tidak ditemukan');
  const end = sql.indexOf('$$;', start);
  assert.notEqual(end, -1, 'badan app.is_ceo() tidak tertutup');
  return sql.slice(start, end);
}

test('cabang public.users yang hilang mengembalikan false, bukan true', () => {
  const body = isCeoBody(read(FOUNDATION));
  const branch = /if to_regclass\('public\.users'\) is null then([\s\S]*?)end if;/.exec(body);
  assert.ok(branch, 'cabang to_regclass tidak ditemukan');

  const returns = [...branch[1].matchAll(/return\s+(true|false)\s*;/g)].map((m) => m[1]);
  assert.deepEqual(
    returns,
    ['false'],
    `cabang tabel yang hilang harus mengembalikan tepat satu nilai false, ditemukan: ${returns.join(', ')}`,
  );
  assert.doesNotMatch(
    branch[1],
    /return\s+true\s*;/,
    'fail-open BE-022 kembali: cabang public.users yang hilang mengembalikan true',
  );
});

test('verifikasi lapis 2 (baris users) tidak dihapus', () => {
  const body = isCeoBody(read(FOUNDATION));
  assert.match(body, /u\.firebase_uid\s*=/, 'lapis 2 harus tetap mencocokkan firebase_uid');
  assert.match(body, /u\.role::text\s*=\s*'CEO'/, 'lapis 2 harus tetap menuntut role CEO');
  assert.match(body, /u\.disabled\s*=\s*false/, 'lapis 2 harus tetap menuntut tidak disabled');
  assert.match(body, /u\.deleted_at\s*is null/, 'lapis 2 harus tetap menuntut belum dihapus');
});

test('toleransi create-time dipertahankan lewat plpgsql + EXECUTE', () => {
  // Menambah `return false` TIDAK boleh merusak pembuatan fungsi di database
  // yang belum punya `public.users`. Penyangga itu `language plpgsql` + `EXECUTE`,
  // yang me-resolve relasi saat fungsi dipanggil, bukan saat `create` di-parse.
  const sql = read(FOUNDATION);
  const declaration = sql.slice(
    sql.indexOf('create or replace function app.is_ceo()'),
    sql.indexOf('$$;', sql.indexOf('create or replace function app.is_ceo()')),
  );
  assert.match(declaration, /language\s+plpgsql/, 'fungsi wajib plpgsql');
  assert.match(declaration, /security\s+invoker/);
  assert.match(declaration, /execute\s+\$q\$[\s\S]*from public\.users u/);
});

test('policy users tidak memanggil app.is_ceo(), jadi rekursi tetap terikat', () => {
  // app.is_ceo() membaca public.users, dan policy users `for all`. Kalau policy
  // itu memanggil app.is_ceo() lagi, evaluasi menjadi rekursif tak terbatas.
  // Inilah satu-satunya yang menahan itu (0001:79-80), jadi harus dijaga.
  const sql = read(RLS_AND_REALTIME);
  const policy = /create policy snapbox_users_scope on public\.users([\s\S]*?);/.exec(sql);
  assert.ok(policy, 'snapbox_users_scope tidak ditemukan');
  assert.doesNotMatch(
    policy[1],
    /app\.is_ceo\(\)/,
    'policy users memanggil app.is_ceo(): rekursi RLS tanpa batas',
  );

  // Kasus saudara: policy notifications membaca public.users. Bentuknya sama —
  // kedalaman satu, tanpa rantai.
  const notifications =
    /create policy snapbox_notifications_scope on public\.notifications([\s\S]*?);/.exec(sql);
  assert.ok(notifications, 'snapbox_notifications_scope tidak ditemukan');
  assert.match(notifications[1], /from public\.users u/);
  assert.doesNotMatch(notifications[1], /app\.is_ceo\(\)\s+or\s+exists[\s\S]*from public\.users/);
});
