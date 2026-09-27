import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

/**
 * GUARD 1 — token warna yang tidak terdefinisi.
 *
 * APA YANG DIGAGAK. Tailwind v4 tidak Issuing apa pun untuk utility yang
 * menunjuk variabel tema yang tidak ada. `text-muted-foreground` tanpa
 * `--color-muted-foreground` menghasilkan satu class yang TIDAK ADA: bukan
 * error, bukan warning, bukan kegagalan build, dan tidak muncul di mana pun.
 * Audit menemukan 66 class seperti itu dan 19 keluarga class, semuanya senyap.
 * Akibatnya dashboard Owner tidak punya hierarki tipografi, error validasi tidak
 * terlihat, segmented control Finance tidak punya state aktif, dan enam layar
 * Super-Admin merender `<section>` telanjang.
 *
 * Guard ini membalik arah kegagalan: utility yang menunjuk nama warna yang
 * tidak ada di theme WAJIB menggagalkan build. Kandidat ditolak, bukan
 * dilewati, dan laporan menyebut file:line supaya bisa langsung diperbaiki.
 *
 * SUMBER KEBENARAN. Nama warna yang sah adalah:
 *   1. palet bawaan Tailwind, dibaca dari `theme.css` paket yang benar-benar
 *      terpasang (bukan daftar yang ditulis tangan), sehingga guard ikut bergerak
 *      sendiri saat Tailwind naik versi;
 *   2. setiap `--color-*` di blok `@theme`/`@theme inline` globals.css dan
 *      packages/ui/src/styles.css.
 * Di luar dua sumber itu, `text-*`/`bg-*`/`border-*`/`ring-*`/`fill-*` (plus
 * stroke, outline, accent, caret, divide) dianggap utility warna dan diperiksa.
 * Hanya isi string dan template literal yang dipindai, jadi prosa tidak pernah
 * diuji sebagai class.
 *
 * SATU LAPIS LEBIH DALAM. `@theme inline` yang menunjuk `var(--tak-ada)`
 * tetap menerbitkannya, hasilnya `var(--tak-ada)`, dan kelasnya ada tapi tidak
 * berwarna. Itu kelas defect yang sama satu lapis lebih dalam, jadi diperiksa
 * juga: setiap `--color-*` yang menunjuk `var(--x)` wajib punya `--x` di `:root`.
 *
 * ARAH KEGAGALAN YANG AMAN. Daftar keyword di bawah ditulis tangan. Kalau
 * Tailwind menambah keyword baru, guard ini GAGAL (suara), bukan lolos
 * diam-diam. Itu arah yang benar untuk sebuah guard.
 *
 * PEMAKAIAN.
 *   node scripts/check-style-tokens.mjs            cek repo
 *   node scripts/check-style-tokens.mjs --self-test guard menguji guard
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

/** Prefiks yang di Tailwind v4 memetakan ke namespace `--color-*`. */
const COLOUR_PREFIXES = [
  'text',
  'bg',
  'border',
  'ring',
  'fill',
  'stroke',
  'outline',
  'accent',
  'caret',
  'divide',
];

/** `transparent` dan `current` adalah utility inti, bukan token palet. */
const STATIC_COLOUR_NAMES = new Set(['transparent', 'current', 'inherit']);

/**
 * Keyword utility BERWAWARNA yang bukan warna, per prefiks. Daftar ini satu-
 *-satunya tempat yang perlu ditambah ketika Tailwind menambah keyword baru.
 * Angka, arbitrary value `[...]`, dan interpolasi template ditangani lewat
 * bentuk kandidat, bukan lewat daftar ini.
 */
const NON_COLOUR_KEYWORDS = {
  text: [
    // ukuran
    '2xs',
    'xs',
    'sm',
    'base',
    'lg',
    'xl',
    '2xl',
    '3xl',
    '4xl',
    '5xl',
    '6xl',
    '7xl',
    '8xl',
    '9xl',
    // perataan dan pembungkusan
    'left',
    'center',
    'right',
    'justify',
    'start',
    'end',
    'wrap',
    'nowrap',
    'balance',
    'pretty',
    'ellipsis',
    'clip',
    // dekorasi teks
    'decoration',
    'underline',
    'overline',
    'line-through',
    'no-underline',
  ],
  bg: ['none', 'fixed', 'local', 'scroll', 'clip-border', 'clip-padding', 'clip-content'],
  border: ['solid', 'dashed', 'dotted', 'double', 'hidden', 'none', 'collapse', 'separate'],
  ring: ['inset'],
  fill: ['none', 'mode-forwards', 'mode-backwards', 'mode-both', 'opacity'],
  stroke: ['none', 'width'],
  outline: ['none', 'hidden', 'solid', 'dashed', 'dotted', 'double', 'offset'],
  accent: [],
  caret: [],
  divide: [],
};

/** Suffix angka (lebar, ukuran, offset) yang bukan nama warna. */
const NUMERIC = /^-?\d+(\.\d+)?$/;

/**
 * Bentuk sama tanpa jangkar, untuk mem-parse satu utility yang sudah terisolasi.
 * Grup varian sengaja menerima `=` dan `>` supaya varian berbentuk atribut —
 * `has-data-[variant=inset]:`, `aria-[current=page]:` — ikut terurai.
 */
const UTILITY_SHAPE = `(?:[\\w.[\\]<>=-]+:)*(${COLOUR_PREFIXES.join('|')})-([a-z][a-z0-9-]*)`;

/**
 * Kandidat utility di dalam teks. Jangkar depan menyertakan `:` dan `]` supaya
 * utility yang didahului varian atribut tidak lolos dari pemeriksaan. Tanpa itu
 * `has-data-[variant=inset]:bg-sidebar` terlihat sah karena `bg-sidebar`-nya
 * tidak pernah tercatat sebagai kandidat — persis kelas defect yang guard ini
 * dibuat untuk menutupnya.
 */
const UTILITY = new RegExp(`(?:^|(?<=["'\`\\s:\\]]))((?:[\\w.[\\]<>=-]+:)*)${UTILITY_SHAPE}`, 'g');

/** Semua string dan template literal. Memindai string saja membuang prosa. */
const STRING_LITERAL = /(`(?:\\.|[^`\\])*`)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')/g;

const GLOBALS_PATH = path.join(root, 'apps/web/src/app/globals.css');
const UI_STYLES_PATH = path.join(root, 'packages/ui/src/styles.css');
const TAILWIND_THEME_CANDIDATES = [
  path.join(root, 'apps/web/node_modules/tailwindcss/theme.css'),
  path.join(root, 'node_modules/tailwindcss/theme.css'),
];

function listSourceFiles(absoluteDir, out = []) {
  for (const entry of readdirSync(absoluteDir)) {
    if (IGNORED_DIRECTORIES.has(entry) || entry.startsWith('.')) continue;
    const full = path.join(absoluteDir, entry);
    if (statSync(full).isDirectory()) listSourceFiles(full, out);
    else if (SOURCE_EXTENSIONS.has(path.extname(entry))) out.push(full);
  }
  return out;
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1 ');
}

/** Isi blok pertama yang opener-nya cocok, atau `null`. */
function readBlock(text, opener) {
  const pattern = new RegExp(`^${opener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]*\\{`, 'm');
  const match = pattern.exec(text);
  if (!match) return null;
  let depth = 0;
  for (let index = match.index; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(match.index + match[0].length, index);
    }
  }
  return null;
}

function readDeclarations(block) {
  const declarations = new Map();
  if (block === null) return declarations;
  for (const line of block.split('\n')) {
    const match = /^\s*(--[A-Za-z0-9-]+)\s*:\s*([^;]+);/.exec(line);
    if (match) declarations.set(match[1], match[2].trim());
  }
  return declarations;
}

/** Palet warna bawaan Tailwind dari paket yang benar-benar terpasang. */
function readDefaultPalette() {
  const themePath = TAILWIND_THEME_CANDIDATES.find((candidate) => {
    try {
      readFileSync(candidate);
      return true;
    } catch {
      return false;
    }
  });
  if (!themePath) {
    throw new Error(
      'theme.css Tailwind tidak ditemukan. Guard tidak boleh berjalan tanpa palet ' +
        'bawaan, karena itu ia akan menandai ratusan class yang sah. Pasang ' +
        'dependensi workspace lalu jalankan ulang.',
    );
  }
  const names = new Set();
  for (const match of readFileSync(themePath, 'utf8').matchAll(/^\s*--color-([a-z0-9-]+)\s*:/gm)) {
    names.add(match[1]);
  }
  return { names, themePath };
}

/**
 * Token warna proyek plus laporan `--color-*` yang menunjuk `var(--x)` yang
 * tidak dideklarasikan di `:root`.
 */
function readProjectColours(cssFiles) {
  const allowed = new Set();
  const dangling = [];

  for (const { label, text } of cssFiles) {
    const theme = readBlock(text, '@theme') ?? '';
    const rootVars = new Set(readDeclarations(readBlock(text, ':root')).keys());

    for (const match of theme.matchAll(/^\s*(--color-([a-z0-9-]+))\s*:\s*([^;]+);/gm)) {
      allowed.add(match[2]);
      const reference = /^var\(\s*(--[A-Za-z0-9-]+)\s*\)$/.exec(match[3].trim());
      if (reference && !rootVars.has(reference[1])) {
        dangling.push(`${label}: ${match[1]} -> var(${reference[1]}) tidak ada di :root`);
      }
    }
  }

  return { allowed, dangling };
}

/** Pecah kandidat menjadi `{ prefix, name }`; `null` bila bukan utility warna. */
export function parseColourUtility(utility) {
  const match = new RegExp(`^${UTILITY_SHAPE}$`).exec(utility);
  return match ? { prefix: match[1], name: match[2] } : null;
}

/**
 * Satu-satunya keputusan yang diambil guard ini.
 *
 * @returns `true` bila utility itu sah, `false` bila ia menunjuk nama warna
 *   yang tidak terdefinisi.
 */
export function isKnownColourUtility(utility, allowedColours) {
  const parsed = parseColourUtility(utility);
  if (!parsed) return true;
  let { name } = parsed;
  const { prefix } = parsed;

  // `bg-chart-${n}`: nama dirangkai saat runtime, tidak bisa diperiksa statis.
  if (name.endsWith('-')) return true;

  // Modifier arah, axis, dan sub-namespace. `border-t-border` (warna),
  // `border-t-2` (lebar), `ring-offset-2` (offset), `divide-y-2` (lebar)
  // semuanya sah; hanya bagian setelah modifier yang menentukan warnanya.
  // Tidak ada token warna di palet Tailwind maupun di proyek ini yang diawali
  // satu huruf + tanda hubung, jadi perepotan ini tidak pernah menelan warna.
  name = name.replace(/^(?:[xytrblse]-|offset-)/, '');

  const slash = name.indexOf('/');
  if (slash !== -1) name = name.slice(0, slash);

  // `border-b`, `border-t`: lebar arah tanpa nilai, bukan warna.
  if (name === '' || /^[xytrblse]$/.test(name) || NUMERIC.test(name)) return true;
  if (STATIC_COLOUR_NAMES.has(name)) return true;
  if (NON_COLOUR_KEYWORDS[prefix].includes(name)) return true;
  return allowedColours.has(name);
}

function scanFiles(files, allowedColours) {
  const violations = [];

  for (const file of files) {
    const source = stripComments(readFileSync(file, 'utf8'));

    for (const literal of source.matchAll(STRING_LITERAL)) {
      for (const match of literal[0].matchAll(UTILITY)) {
        const utility = match[0].trim();
        if (isKnownColourUtility(utility, allowedColours)) continue;
        const index = literal.index + match.index;
        violations.push({
          file: path.relative(root, file),
          line: source.slice(0, index).split('\n').length,
          utility,
        });
      }
    }
  }

  return violations;
}

/**
 * Guard menguji guard. Guard hanya dipercaya bila ia MENANG atas input buruk
 * yang diketahui dan TIDAK menang atas input baik. Tanpa ini, guard yang hanya
 * diam akan selalu hijau dan dianggap benar.
 *
 * Nama-nama di `bad` SENGAJA bukan token sungguhan. Ia harus tetap tidak
 * terdefinisi setelah token semantik diperbaiki — kalau daftarnya memakai nama
 * yang baru saja didefinisikan (`muted-foreground`, `primary`, `sidebar`),
 * guard akan menguji dirinya sendiri dengan input yang sudah sah dan melapor
 * bahwa ia tidak berfungsi setiap kali seseorang menambah token. Bug asli yang
 * memicu guard ini dicatat di kepala berkas, bukan di sini.
 */
function selfTest(allowedColours, verbose) {
  const bad = [
    'text-not-a-real-token',
    'bg-primary-foreground-typo',
    'border-destructive-typo',
    'ring-sidebar-variant',
    'fill-status-dangr',
    'bg-chart-9',
    'border-t-accent-1',
    'outline-info',
    'focus-visible:ring-foreground-typo',
    // Varian atribut: regression. Jangkar lama membuat `bg-` di sini tidak
    // pernah tercatat sebagai kandidat, sehingga guard buta padanya.
    'has-data-[variant=inset]:bg-sidebar-typo',
    'group-data-[collapsible=offcanvas]:bg-sidebar-typo',
    'aria-[current=page]:text-primary-foreground-typo',
  ];
  const good = [
    'text-foreground',
    'bg-main',
    'bg-chart-1',
    'border-2',
    'border-t-foreground',
    'border-t-2',
    'border-b',
    'text-sm',
    'text-left',
    'bg-transparent',
    'ring-offset-2',
    'text-muted-foreground/70',
    'bg-chart-${n}',
    'bg-[var(--x)]',
    'focus-visible:outline-2',
    'border-dashed',
    'divide-y-2',
    'text-2xl',
    'bg-[color:var(--main)]',
    'has-data-[variant=inset]:bg-main',
    'group-data-[collapsible=offcanvas]:bg-foreground',
  ];
  const missed = bad.filter((utility) => isKnownColourUtility(utility, allowedColours));
  const falsePositives = good.filter((utility) => !isKnownColourUtility(utility, allowedColours));

  if (verbose) {
    process.stdout.write('Guard 1 -- uji mandiri, input buruk harus TERTANGKAP:\n');
    for (const utility of bad) {
      process.stdout.write(`  ${missed.includes(utility) ? 'LEWAT  ' : 'tangkap'}  ${utility}\n`);
    }
    process.stdout.write('Guard 1 -- uji mandiri, input baik harus LOLOS:\n');
    for (const utility of good) {
      process.stdout.write(
        `  ${falsePositives.includes(utility) ? 'GAGAL  ' : 'lolos  '}  ${utility}\n`,
      );
    }
  }

  if (missed.length > 0 || falsePositives.length > 0) {
    process.stderr.write(
      `\nGAGAL: guard tidak dapat dipercaya. ${missed.length} input buruk lolos, ` +
        `${falsePositives.length} input baik ditolak.\n` +
        (missed.length > 0 ? `  lolos: ${missed.join(', ')}\n` : '') +
        (falsePositives.length > 0 ? `  ditolak: ${falsePositives.join(', ')}\n` : '') +
        'Perbaiki daftar keyword atau logika klasifikasinya sebelum mempercayai ' +
        'hasil repo di bawah.\n',
    );
    return false;
  }
  return true;
}

function main() {
  const { names: defaultPalette, themePath } = readDefaultPalette();
  const cssFiles = [
    { label: 'apps/web/src/app/globals.css', text: readFileSync(GLOBALS_PATH, 'utf8') },
    { label: 'packages/ui/src/styles.css', text: readFileSync(UI_STYLES_PATH, 'utf8') },
  ];
  const { allowed: projectColours, dangling } = readProjectColours(cssFiles);
  const allowedColours = new Set([...defaultPalette, ...projectColours]);

  const selfTestOnly = process.argv.includes('--self-test');
  if (!selfTest(allowedColours, selfTestOnly)) process.exit(1);
  if (selfTestOnly) process.exit(0);

  const files = SOURCE_ROOTS.flatMap((relative) => listSourceFiles(path.join(root, relative)));
  const violations = scanFiles(files, allowedColours);

  const failures = [
    ...dangling.map((message) => `${message} (utility terbit, nilainya kosong)`),
    ...violations.map(
      (violation) => `${violation.file}:${violation.line} \`${violation.utility}\``,
    ),
  ];

  if (failures.length > 0) {
    process.stderr.write(
      'GAGAL: utility warna menunjuk token yang tidak terdefinisi. Tailwind v4 ' +
        'menerbitkannya sebagai kelas yang tidak ada — tanpa error, tanpa warning, ' +
        'tanpa kegagalan build.\n\n',
    );
    for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
    process.stderr.write(
      '\nTambahkan warnanya di :root DAN --color-* di @theme inline (kedua berkas CSS),\n' +
        'atau ubah class ke token yang benar-benar ada. Jangan menambah token hanya\n' +
        'agar guard diam.\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    `Token warna lengkap: ${allowedColours.size} nama sah (${defaultPalette.size} dari palet ` +
      `Tailwind + ${projectColours.size} token proyek), ${files.length} berkas sumber diperiksa, ` +
      `0 utility menunjuk token yang tidak ada.\n  palet: ${path.relative(root, themePath)}\n`,
  );
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
