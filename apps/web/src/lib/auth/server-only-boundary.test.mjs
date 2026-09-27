/**
 * Guard batas server/client (P-B-40, BE-034).
 *
 * `import 'server-only'` adalah satu-satunya mekanisme yang benar-benar
 * menggagalkan build saat modul server diimpor dari komponen client. Semua
 * pemeriksaan lain (nama file, konvensi, review) bisa dilewati tanpa-biaya.
 *
 * Yang dijaga:
 * 1. Modul yang komponen client impor HARUS bebas `server-only` — kalau tidak,
 *    aplikasi tidak bisa dibangun sama sekali.
 * 2. Modul yang membaca secret, database, atau `next/*` WAJIB punya
 *    `server-only`. Tanpa itu, satu `import` keliru akan membocorkan
 *    `SUPABASE_SERVICE_ROLE_KEY` ke bundle browser.
 * 3. `Strict-Transport-Security` dan `Content-Security-Policy` harus benar-benar
 *    ada di konfigurasi, dan CSP tidak boleh memakai `unsafe-eval` di production
 *    maupun `object-src *`.
 *
 * Dijalankan `node --test` dari root repo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  '..',
);
const srcDir = path.join(root, 'apps', 'web', 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) out.push(full);
  }
  return out;
}

const FILES = walk(srcDir);
const SERVER_ONLY = /^import 'server-only';/m;

/**
 * Modul yang menjadi server boundary karena isinya menyentuh secret, database,
 * atau API khusus server.
 *
 * `node:crypto` sengaja TIDAK ada di sini: `pairing-token.ts` dan
 * `device-token.ts` memakainya, tetap murni, dan sengaja bisa diuji `node --test`
 * tanpa loader. Yang menentukan adalah apakah modul itu memegang rahasia atau
 * membuka koneksi.
 */
const SECRET_PATTERN =
  /SUPABASE_SERVICE_ROLE_KEY|FIREBASE_ADMIN|PAKASIR_B2B_WEBHOOK_SECRET|RESEND_API_KEY|ENCRYPTION_MASTER_KEY|getDatabase|next\/headers|next\/server/;

/**
 * Impor BER-NILAI dari `@snapbox/db` (bukan `import type`).
 *
 * Modul kontrak murni mengimpor *tipe* baris dan fitur dari skema drizzle.
 * Tipe hilang saat di-bundle, jadi mengunci modul itu akan mematikan build tanpa
 * membocorkan apa pun. Yang berbahaya adalah nilai: instance database dan
 * helper yang mengubahnya.
 */
const DB_VALUE_IMPORT = /import\s+(?!type\b)[^;]*from\s+'@snapbox\/db';/;

/** Yang boleh diimpor komponen client (Edge middleware, kontrak murni). */
const EDGE_SAFE = new Set([
  'middleware.ts',
  path.join('lib', 'auth', 'route-policy.ts'),
  path.join('lib', 'auth', 'csp.ts'),
  path.join('lib', 'auth', 'same-origin.ts'),
  path.join('lib', 'auth', 'rate-limit.ts'),
  path.join('lib', 'auth', 'pin.ts'),
  path.join('lib', 'auth', 'session.ts'),
]);

const read = (file) => fs.readFileSync(file, 'utf8');

/**
 * Sumber modul tidak boleh menyentuh batas runtime server: nilai database,
 * `next/*`, atau handle `firebase-admin`. Impor `import type` dan komentar
 * diabaikan karena keduanya hilang sebelum modul dieksekusi.
 */
function assertNoRuntimeBoundary(label, source) {
  const runtime = source
    .replace(/import\s+type\s+[^;]*;/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(runtime, /@snapbox\/db|next\/headers|next\/server|firebase-admin/, label);
}

test('tidak ada modul server-only yang diimpor komponen client', () => {
  const serverOnlyFiles = new Set(FILES.filter((f) => SERVER_ONLY.test(read(f))));
  assert.ok(serverOnlyFiles.size > 0, 'guard ini akan basi kalau tidak ada satu pun server-only');

  const offenders = [];
  for (const file of FILES) {
    if (!read(file).startsWith("'use client'")) continue;
    for (const match of read(file).matchAll(/from ['"]([^'"]+)['"]/g)) {
      const spec = match[1];
      if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
      const resolved = spec.startsWith('@/')
        ? path.join(srcDir, spec.slice(2))
        : path.resolve(path.dirname(file), spec);
      const target = fs.existsSync(resolved) ? resolved : `${resolved}.ts`;
      if (fs.existsSync(target) && serverOnlyFiles.has(target)) {
        offenders.push(`${path.relative(root, file)} -> ${spec}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `komponen client mengimpor modul server-only:\n${offenders.join('\n')}`,
  );
});

test('modul yang menyentuh secret atau DB punya server-only', () => {
  const missing = [];
  for (const file of FILES) {
    const source = read(file);
    const rel = path.relative(srcDir, file);

    if (EDGE_SAFE.has(rel)) continue;
    // Modul `'use server'` sudah ditegakkan direktifnya. Menambah `server-only`
    // di sana justru MERUSAK: komponen client harus boleh mengimpornya, karena
    // itulah satu-satunya cara memanggil server action.
    if (/^'use server';/m.test(source)) continue;
    if (!SECRET_PATTERN.test(source) && !DB_VALUE_IMPORT.test(source)) continue;
    if (SERVER_ONLY.test(source)) continue;

    missing.push(rel);
  }

  assert.deepEqual(missing, [], `modul server tanpa 'server-only':\n${missing.join('\n')}`);
});

test('kontrak murni yang dipakai client tidak dikunci', () => {
  // Daftar di sini menjaga pesan kegagalan tetap menyebut file yang salah, karena
  // pesan build Next tidak menyebutkannya.
  const pure = [
    'lib/ceo-dashboard/plan-contract.ts',
    'lib/ceo-dashboard/promo-contract.ts',
    'lib/ceo-dashboard/tenant-contract.ts',
    'lib/ceo-dashboard/audit-contract.ts',
    'lib/entitlement/entitlement-contract.ts',
    'lib/entitlement/plan-features-shape.ts',
    'lib/owner-dashboard/machine-contract.ts',
    'lib/owner-dashboard/kiosk-theme-contract.ts',
    'lib/booth/pairing-token.ts',
  ];

  for (const rel of pure) {
    const source = read(path.join(srcDir, rel));
    assert.doesNotMatch(source, SERVER_ONLY, `${rel} dikunci tapi murni`);
    assertNoRuntimeBoundary(rel, source);
  }
});

test('harness Node memuat server-only lewat kondisi react-server', () => {
  /*
   * `server-only` melempar di kondisi default. Tanpa flag ini, modul mana pun
   * yang dikunci tidak bisa dimuat oleh `node --test` atau skrip operator, dan
   * satu-satunya jalan keluar adalah MELONGGAR kunci itu, yaitu menukar
   * kenyamanan tooling dengan kontrol di aplikasi.
   *
   * Kondisi `react-server` adalah kondisi yang sama dengan yang dipakai Next,
   * jadi modul yang terkunci tetap terkunci untuk bundel browser, sementara
   * harness dapat memuatnya. Flag ini ada di script `test` dan di ketiga skrip
   * `seed:claims` / `verify:security` / `verify:runtime`; test ini menjaga
   * supaya tidak ada yang menghapusnya.
   */
  const rootPkg = JSON.parse(read(path.join(root, 'package.json')));
  for (const [name, expected] of [
    ['test', '--conditions=react-server'],
    ['seed:claims', '--conditions=react-server'],
    ['verify:security', '--conditions=react-server'],
    ['verify:runtime', '--conditions=react-server'],
  ]) {
    const script = rootPkg.scripts[name] ?? '';
    assert.ok(
      script.includes(expected),
      `script "${name}" harus memakai ${expected}; tanpa itu modul terkunci tidak bisa dimuat`,
    );
  }

  assert.ok(
    rootPkg.devDependencies['server-only'],
    'server-only harus terpasang di root, kalau tidak conditions tidak berguna',
  );
});

test('modul penandatangan device dikunci seperti modul server lain', () => {
  // Dulu exempted karena harus bisa dimuat harness. Sekarang harness memakai
  // kondisi react-server, jadi pengecualian itu tidak dibutuhkan lagi dan
  // menambah satu permukaan yang tidak terkunci.
  for (const rel of ['lib/booth/device-token.ts', 'lib/owner-dashboard/payment-crypto.ts']) {
    assert.match(read(path.join(srcDir, rel)), SERVER_ONLY, `${rel} harus dikunci`);
    assertNoRuntimeBoundary(rel, read(path.join(srcDir, rel)));
  }
});

test('CSP dan HSTS benar-benar ada, dan tidak Unsafe di produksi', () => {
  const config = read(path.join(root, 'apps', 'web', 'next.config.ts'));
  const middleware = read(path.join(srcDir, 'middleware.ts'));
  const csp = read(path.join(srcDir, 'lib', 'auth', 'csp.ts'));
  const tauri = read(path.join(root, 'apps', 'desktop', 'src-tauri', 'tauri.conf.json'));

  // HSTS adalah header statis, jadi ia tinggal di next.config.
  assert.match(config, /Strict-Transport-Security/);
  assert.match(config, /max-age=\d+/);
  assert.match(config, /includeSubDomains/);
  // `preload` mengikat seluruh subdomain dan tidak bisa diputuskan di repo ini.
  // Yang dicari adalah nilainya di dalam header, bukan kata "preload" di komentar.
  const hsts = /const strictTransportSecurity = '([^']+)'/.exec(config);
  assert.ok(hsts, 'nilai HSTS harus ditulis literal agar bisa diperiksa');
  assert.doesNotMatch(hsts[1], /preload/, 'preload tidak boleh aktif dari repo');
  assert.match(config, /key: 'Strict-Transport-Security', value: strictTransportSecurity/);

  // CSP harus per-request, jadi HARUS di middleware. Kalau pindah ke
  // next.config, nonce-nya tidak akan pernah cocok dan aplikasinya tidak memuat.
  assert.match(middleware, /Content-Security-Policy/);
  assert.match(middleware, /buildContentSecurityPolicy/);
  assert.match(middleware, /x-nonce/);
  assert.doesNotMatch(config, /Content-Security-Policy/, 'CSP jangan diduplikasi di next.config');

  // Aturan yang tidak bisa ditawar.
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /object-src \*/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  // `unsafe-eval` hanya boleh untuk development, dan harus kondisional.
  assert.match(csp, /development \? " 'unsafe-eval'" : ''/);
  assert.doesNotMatch(csp, /'unsafe-inline'.*script-src|script-src[^\n]*'unsafe-inline'/);

  // Directive yang dibutuhkan fitur nyata.
  assert.match(csp, /wss:\/\/\*\.supabase\.co/);

  // Tauri: object-src/base-uri/form-action ditambahkan.
  for (const directive of ["object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
    assert.ok(tauri.includes(directive), `tauri.conf.json belum punya ${directive}`);
  }
  assert.doesNotMatch(tauri, /script-src[^\n]*unsafe-inline/);
});

test('lapisan identity-dimensi ada di aplikasi, bukan di edge', () => {
  // Dimensi yang bergantung pada header request tidak bisa ditegakkan di edge:
  // nilainya dikontrol penyerang. Yang ditegakkan adalah sisi aplikasi, dengan
  // nilai yang sudah diverifikasi terhadap DB.
  const rateLimit = read(path.join(srcDir, 'lib', 'auth', 'rate-limit.ts'));
  assert.match(rateLimit, /boothDeviceRateLimitKey/);
  assert.match(rateLimit, /checkBoothDeviceRateLimit/);

  // `buckets.clear()` hanya boleh ada di helper reset milik test. Di jalur
  // requests, membersihkannya berarti menghapus penghitung semua pengguna —
  // dan itulah kontrol yang hilang selama ini.
  const evict = rateLimit.slice(
    rateLimit.indexOf('function evictExpired'),
    rateLimit.indexOf('function consume'),
  );
  assert.doesNotMatch(
    evict,
    /buckets\.clear\(\)/,
    'buckets.clear() di jalur request menghapus penghitung semua pengguna',
  );
  // Satu-satunya `clear()` yang sah adalah helper reset yang hanya dipanggil
  // test. Kemunculan di dalam komentarcalculate tidak dihitung.
  const code = rateLimit.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const clears = [...code.matchAll(/buckets\.clear\(\)/g)];
  assert.equal(clears.length, 1, 'hanya boleh ada satu buckets.clear(), di helper reset');
  assert.match(code.slice(clears[0].index - 200), /export function resetAuthRateLimits/);

  const rules = read(path.join(root, 'infra', 'cloudflare', 'rate-limit-rules.json'));
  for (const rule of JSON.parse(rules).rules) {
    for (const characteristic of rule.ratelimit.characteristics) {
      assert.equal(
        typeof characteristic,
        'string',
        'karakteristik harus berupa string yang bisa dibaca guard',
      );
      assert.ok(
        !characteristic.includes('http.request.headers'),
        `rule ${rule.name} memakai header yang bisa diputar penyerang`,
      );
    }
  }
});
