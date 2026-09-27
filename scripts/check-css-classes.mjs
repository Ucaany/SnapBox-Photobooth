import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

/**
 * GUARD 2 — class `.ceo-*`, `.owner-*`, `.public-*`, `.auth-*` yang tidak punya
 * aturan.
 *
 * APA YANG DIGAGAK. `className="ceo-panel"` tanpa aturan `.ceo-panel` di CSS
 * tidak menghasilkan apa pun. Berbeda dengan utility Tailwind yang temanya
 * hilang, ini bahkan lebih senyap: tidak ada kompilator, tidak ada linter,
 * tidak ada build yang menyentuhnya. Elemennya tetap dirender, tetap punya
 * ukuran, dan terlihat "berhasil" — hanya tanpa border, tanpa radius, tanpa
 * bayangan, tanpa hierarki tipografi.
 *
 * Dampaknya nyata dan sudah dihitung: enam halaman Super-Admin merender
 * `<section>` telanjang, dan dua halaman Owner (settings, support) merender
 * `<input>`/`<select>`/`<textarea>`/`<button>` tanpa satu pun kelas Tailwind.
 *
 * KENAPA HANYA EMPAT PREFIX INI. Prefiks ini adalah penanda CSS yang ditulis
 * tangan, bukan utility Tailwind. Utility Tailwind punya nama namespace yang
 * sudah dijaga guard 1; class skop-skop ini tidak punya mekanisme apa pun, jadi
 * dialah yang perlu dijaga. Class scoped lain yang tidak berawalan empat
 * prefix ini berada di luar cakupan guard dan tidak dilaporkan.
 *
 * BATAS PENCARIAN. Hanya string di dalam (atribut `className`/`class`, dan
 * pemanggilan `cn()`/`cva()`/`clsx()`/`twMerge()`) yang diperiksa — bukan
 * seluruh string di berkas. Itu disengaja: memindai semua string akan
 * menandai jalur import, fixture pengujian, dan potongan kode yang tertanam di
 * template literal sebagai class yang tidak terdefinisi, dan itu membuat guard
 * tidak berguna.
 *
 * ATURAN MATI. Laporan juga menghitung aturan berawalan empat prefix ini yang
 * tidak dipakai siapa pun. Itu DITAMPILKAN, bukan digagalkan: memilih adopsi
 * atau hapus adalah keputusan Fase 4 (P-F-09 butir 6), bukan keputusan yang
 * boleh diambil diam-diam oleh sebuah guard. Jumlahnya tidak boleh naik.
 *
 * PEMAKAIAN.
 *   node scripts/check-css-classes.mjs            cek repo
 *   node scripts/check-css-classes.mjs --self-test guard menguji guard
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE_ROOTS = ['apps/web/src', 'packages/ui/src'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts']);
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
]);

/** Prefiks penanda CSS yang ditulis tangan, bukan utility Tailwind. */
const GUARDED_PREFIXES = ['ceo', 'owner', 'public', 'auth'];

/**
 * Pemegang class. Nilai adalah nama fungsi atau atribut; `(` menandai pemanggilan
 * fungsi ( Needs dipindai sampai kurung tutup), sisanya adalah atribut JSX.
 */
const CLASS_CARRIERS = [
  'className',
  'class',
  'containerClassName',
  'cn(',
  'cva(',
  'clsx(',
  'twMerge(',
];
const CARRIER = new RegExp(
  `\\b(?:${CLASS_CARRIERS.map((name) => name.replace('(', '\\(')).join('|')})`,
  'g',
);

const GUARDED_CLASS = new RegExp(
  `\\b(${GUARDED_PREFIXES.join('|')})-[a-z0-9]+(?:-[a-z0-9]+)*\\b`,
  'g',
);

/** String dan template literal. */
const STRING_LITERAL = /(`(?:\\.|[^`\\])*`)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')/g;

const GLOBALS_PATH = path.join(root, 'apps/web/src/app/globals.css');

function listSourceFiles(absoluteDir, out = []) {
  for (const entry of readdirSync(absoluteDir)) {
    if (IGNORED_DIRECTORIES.has(entry) || entry.startsWith('.')) continue;
    const full = path.join(absoluteDir, entry);
    if (statSync(full).isDirectory()) listSourceFiles(full, out);
    else if (SOURCE_EXTENSIONS.has(path.extname(entry))) out.push(full);
  }
  return out;
}

/**
 * Buang komentar sambil MEMPERTAHIKAN jumlah baris, supaya nomor baris di
 * laporan tetap benar.
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1 ');
}

/**
 * Nama class yang benar-benar terdefinisi di globals.css.
 *
 * globals.css adalah satu-satunya entry point Tailwind untuk aplikasi web;
 * `packages/ui/src/styles.css` TIDAK ikut dihitung, karena web tidak
 * meng-import-nya (lihat kepala berkas itu). Aturan di berkas lain tidak akan
 * sampai ke DOM, jadi menghitungnya membuat guard berbohong.
 */
export function readDefinedClasses(css) {
  const text = stripComments(css)
    .replace(/@(?:import|plugin|source|apply|variant|config|reference)\b[^;]*;/g, '')
    .replace(/@(?:keyframes|font-face|property)\b[^{]*\{[^}]*\}/g, '');

  const defined = new Set();
  let preludeStart = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') {
      // Prekuden setiap blok, SEDANGKAN di dalam `@layer`/`@media`/`@supports`.
      // Mengambilnya hanya di kedalaman 0 akan kehilangan seluruh aturan yang
      // dibungkus at-rule, dan itu sebagian besar isi globals.css.
      for (const match of text.slice(preludeStart, index).matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
        defined.add(match[1]);
      }
      preludeStart = index + 1;
    } else if (char === '}' || char === ';') {
      preludeStart = index + 1;
    }
  }

  return defined;
}

/**
 * Potongan teks yang menjadi pemilik class, beserta posisi mulainya di sumber.
 */
export function collectClassRegions(text) {
  const source = stripComments(text);
  const regions = [];

  for (const carrier of source.matchAll(CARRIER)) {
    let index = carrier.index + carrier[0].length;
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (source[index] === '=') {
      index += 1;
      while (index < source.length && /\s/.test(source[index])) index += 1;
    }

    const open = source[index];
    const closer = { '{': '}', '(': ')', '[': ']' }[open];

    // `className="..."`: nilainya string literal, bukan ekspresi berkurung.
    if (open === "'" || open === '"' || open === '`') {
      const literal = new RegExp(`${open}(?:\\\\.|[^${open}\\\\])*${open}`).exec(
        source.slice(index),
      );
      if (!literal) continue;
      regions.push({ start: index, end: index + literal[0].length, text: literal[0] });
      continue;
    }
    if (!closer) continue;

    let depth = 0;
    for (let cursor = index; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      if (char === "'" || char === '"' || char === '`') {
        const literal = new RegExp(`${char}(?:\\\\.|[^${char}\\\\])*${char}`).exec(
          source.slice(cursor),
        );
        if (literal) {
          cursor += literal[0].length - 1;
          continue;
        }
      }
      if (char === open) depth += 1;
      else if (char === closer) {
        depth -= 1;
        if (depth === 0) {
          regions.push({ start: index, end: cursor + 1, text: source.slice(index, cursor + 1) });
          break;
        }
      }
    }
  }

  return { source, regions };
}

/** Semua class berawalan empat prefix yang terpakai, beserta file:line. */
export function collectUsedClasses(text, relativePath) {
  const { source, regions } = collectClassRegions(text);
  const used = new Map();

  for (const region of regions) {
    for (const literal of region.text.matchAll(STRING_LITERAL)) {
      for (const match of literal[0].matchAll(GUARDED_CLASS)) {
        const name = match[0];
        const index = region.start + literal.index + match.index;
        const line = source.slice(0, index).split('\n').length;
        if (!used.has(name)) used.set(name, new Set());
        used.get(name).add(`${relativePath}:${line}`);
      }
    }
  }

  return used;
}

/**
 * Guard menguji guard. Nama di fixture SENGAJA tidak akan pernah didefinisikan:
 * kalau fixture memakai nama yang baru saja diperbaiki (`ceo-panel`,
 * `owner-section`), guard akan menguji dirinya sendiri dengan input yang sudah
 * sah dan melapor bahwa ia rusak setiap kali seseorang menambah aturan.
 */
function selfTest(defined, verbose) {
  // Bentuk yang harus tertangkap: string literal polos, ekspresi di dalam
  // kurung kurawal, dan pemanggilan cn(). `className="..."` pernah hilang dari
  // pemindaian karena nilai dianggap ekspresi berkurung.
  const undefinedFixture = `
    export function Bad() {
      return <section className="ceo-panel-x" />;
    }
    export function AlsoBad() {
      return <p className={cn('owner-section-y auth-switch-active-y')} />;
    }
  `;
  const definedFixture = `
    export function Good() {
      return <section className="ceo-panel-static flex gap-2" />;
    }
  `;

  const caught = collectUsedClasses(undefinedFixture, 'fixture.tsx');
  const missed = [...caught.keys()].filter((name) => defined.has(name));
  const falsePositives = [...collectUsedClasses(definedFixture, 'fixture.tsx').keys()].filter(
    (name) => !defined.has(name),
  );

  // Impor dan kode tertanam bukan class. Kalau guard salah tread keduanya,
  // ia akan melaporkan class yang tidak pernah ada.
  const noise = collectUsedClasses(
    `import x from '@/app/(owner-dashboard)/owner-dashboard/layout';\n` +
      `const snippet = \`return '/ceo-dashboard';\`;\n` +
      `const path = 'lib/owner-dashboard/owner-account-server.ts';\n`,
    'fixture.tsx',
  );

  if (verbose) {
    process.stdout.write('Guard 2 -- uji mandiri:\n');
    process.stdout.write(
      `  kelas di-<prefix> yang harus TERTANGKAP: ${[...caught.keys()].join(', ')}\n`,
    );
    process.stdout.write(
      `  kelas yang tidak boleh dilaporkan:    ${[...noise.keys()].join(', ') || '(tidak ada)'}\n`,
    );
  }

  if (missed.length > 0 || falsePositives.length > 0 || noise.size > 0) {
    process.stderr.write(
      'GAGAL: guard tidak dapat dipercaya.' +
        (missed.length > 0 ? `\n  input buruk lolos: ${missed.join(', ')}` : '') +
        (falsePositives.length > 0 ? `\n  input baik ditolak: ${falsePositives.join(', ')}` : '') +
        (noise.size > 0
          ? `\n  kelas palsu dari import/path: ${[...noise.keys()].join(', ')}`
          : '') +
        '\n',
    );
    return false;
  }
  return true;
}

function main() {
  const css = readFileSync(GLOBALS_PATH, 'utf8');
  const defined = readDefinedClasses(css);

  const selfTestOnly = process.argv.includes('--self-test');
  if (!selfTest(defined, selfTestOnly)) process.exit(1);
  if (selfTestOnly) process.exit(0);

  const files = SOURCE_ROOTS.flatMap((relative) => listSourceFiles(path.join(root, relative)));
  const used = new Map();
  for (const file of files) {
    const relative = path.relative(root, file);
    for (const [name, locations] of collectUsedClasses(readFileSync(file, 'utf8'), relative)) {
      if (!used.has(name)) used.set(name, new Set());
      for (const location of locations) used.get(name).add(location);
    }
  }

  const undefinedClasses = [...used]
    .filter(([name]) => !defined.has(name))
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
  const deadRules = [...defined]
    .filter((name) => GUARDED_PREFIXES.some((prefix) => name.startsWith(`${prefix}-`)))
    .filter((name) => !used.has(name))
    .sort();

  if (undefinedClasses.length > 0) {
    process.stderr.write(
      'GAGAL: className memakai class berawalan ceo-/owner-/public-/auth- yang tidak ' +
        'punya aturan di globals.css. Elemennya tetap dirender, hanya tanpa style — ' +
        'tanpa error, tanpa warning, tanpa kegagalan build.\n\n',
    );
    for (const [name, locations] of undefinedClasses) {
      process.stderr.write(`  - .${name} (${locations.size} penggunaan)\n`);
      for (const location of [...locations].slice(0, 3)) {
        process.stderr.write(`      ${location}\n`);
      }
    }
    process.stderr.write(
      '\nUntuk tiap class: pakai aturan yang sudah ada (contoh .ceo-panel-static, ' +
        '.ceo-header-kicker),\natau definisikan aturannya, atau hapus pemakaiannya. ' +
        'Jangan menambah aturan kosong hanya agar guard diam.\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    `Class terdefinisi: ${used.size} class ${GUARDED_PREFIXES.map((p) => `.${p}-*`).join('/')} ` +
      `terpakai di ${files.length} berkas, semuanya punya aturan di globals.css.\n` +
      `  ${defined.size} nama class dideklarasikan di globals.css; ` +
      `${deadRules.length} di antaranya tidak terpakai (P-F-09 butir 6, keputusan adopsi ` +
      `atau hapus di Fase 4 — tidak digagalkan guard, tapi tidak boleh bertambah).\n` +
      (deadRules.length > 0 ? `  belum dipakai: ${deadRules.map((n) => `.${n}`).join(' ')}\n` : ''),
  );
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
