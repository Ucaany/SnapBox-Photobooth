import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

/**
 * Penjaga palet brand: satu ramp biru, tanpa gradient.
 *
 * Keputusan: AUDIT/11 D-01 (dijawab 2026-09-26) plus
 * `docs/ADR-005-blue-palette-no-gradients.md`.
 *
 * Sumber kebenaran warna brand adalah `BRAND.palette` di
 * `apps/web/src/content/public.ts`. Skrip ini menegakkan enam hal:
 *
 *  1. Blok brand di `:root` dan di `@theme inline` pada kedua berkas CSS sama
 *     persis dengan `BRAND.palette`. Inilah yang membuat "ubah satu warna
 *     brand" menjadi satu edit, bukan pencarian-ganti seluruh repo.
 *  2. Tidak ada warna brand yang sudah dicabut sebagai hex di `apps/web/src`,
 *     `apps/desktop/src`, dan `packages` — untuk enam ekstensi yang didaftarkan
 *     `SCAN_EXTENSIONS` dan direktori yang dilewati `SCAN_SKIP_DIRS`.
 *     Ini BUKAN jaminan "tidak ada hex terlarang di seluruh repo": `.sql`,
 *     snapshot drizzle, berkas di luar tiga root itu, dan aset biner tidak
 *     dipindai. Default `kiosk_themes` ditutup secara khusus oleh
 *     `packages/db/owner-migrations-invariants.test.mjs` (test D-01), bukan
 *     oleh skrip ini.
 *  3. Tidak ada `linear-gradient`/`radial-gradient`/`conic-gradient` di berkas
 *     yang dipindai, di luar satu allowlist berbasis posisi.
 *  4. `KIOSK_BASE_COLORS` memakai warna dari ramp biru.
 *  5. `themeColor` di `apps/web/src/app/layout.tsx` ada di ramp.
 *  6. Ramp benar-benar satu ramp: `--brand-primary` = `--main` dan
 *     `--brand-mist` = `--background`. Dua pasangan ini pernah hanya dijamin
 *     komentar, dan satu di antaranya memang sudah menyimpang.
 *
 * `--write` menulis ulang blok hasil generate. Tanpa `--write`, skrip hanya
 * melaporkan lalu keluar non-nol.
 *
 * Soket parser sengaja sempit: `BRAND.palette` harus tetap literal objek datar
 * berisi string heksa. Kalau bentuknya berubah, skrip gagal dengan pesan yang
 * menyebut baris, bukan diam-diam menganggur.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const publicTsPath = path.join(root, 'apps/web/src/content/public.ts');
const cssPaths = [
  path.join(root, 'packages/ui/src/styles.css'),
  path.join(root, 'apps/web/src/app/globals.css'),
];
const kioskContractPath = path.join(
  root,
  'apps/web/src/lib/owner-dashboard/kiosk-theme-contract.ts',
);
const rootLayoutPath = path.join(root, 'apps/web/src/app/layout.tsx');
const scanRoots = [
  path.join(root, 'apps/web/src'),
  // Kiosk Vite memakai palet yang sama lewat `--kiosk-*` di styles.css-nya
  // sendiri, bukan pipeline Tailwind web. Sebelum ditambahkan ke sini, seluruh
  // aplikasi desktop masih kuning/violet sementara `check:brand` hijau.
  path.join(root, 'apps/desktop/src'),
  path.join(root, 'packages'),
];

/**
 * Warna yang sudah dicabut D-01 dan tidak boleh muncul sebagai hex di
 * `apps/web`: identitas PRD dan default editor kiosk yang lama.
 */
const RETIRED_BRAND_HEXES = new Map([
  ['#ffdd00', 'kuning PRD'],
  ['#8b5cf6', 'violet PRD'],
  ['#ff1f8f', 'pink PRD'],
  ['#fffef5', 'warm white PRD'],
  ['#f5f0dc', 'cream PRD'],
  ['#d40000', 'primary default editor kiosk lama'],
  ['#4c1d95', 'accent default editor kiosk lama'],
]);

/**
 * Berkas yang boleh MENYEBUT hex yang sudah dicabut, karena tugasnya justru
 * menegakkan transisi dari nilai lama itu.
 *
 * Daftar ini sempit dan beralasan: sebuah uji invarian migrasi harus bisa
 * menulis string `DEFAULT '#FFDD00'` dari baseline 0000 untuk membuktikan bahwa
 * baseline MEMANG masih memuatnya. Melarang hex itu di berkas tersebut akan
 * memaksa uji menulis pemeriksaan yang lebih lemah (mis. hanya nama kolom), dan
 * itu menghapus justru bagian yang menangkap drift.
 *
 * Berkas ini hanya memuat string heksa di dalam assertion test, bukan deklarasi
 * warna yang dirender, jadi tidak ada warna brand yang bisa bocor dari sini.
 */
const RETIRED_HEX_EXEMPT_FILES = new Set(['packages/db/owner-migrations-invariants.test.mjs']);

/**
 * Allowlist gradient, dan isinya hanya satu.
 *
 * Aturannya berbasis POSISI, bukan jumlah: gradient hanya boleh berada di
 * dalam aturan `.checkerboard`, yaitu peta transparansi 8px di
 * `apps/web/src/app/globals.css`. Peta itu dibangun dari empat
 * `linear-gradient()`. Ia affordance standar untuk menunjukkan transparansi
 * gambar, BUKAN identitas brand, dan PRD Task 2.5 mewajibkan checkerboard di
 * Frame Studio. Owner sudah menyetujui pengecualian ini pada 2026-09-26 dan
 * AUDIT/11 D-01 menyebutnya secara eksplisit.
 *
 * Bentuk aturan ini membuat allowlist ikut mati sendiri: menghapus
 * `.checkerboard` menutup semua gradient, dan gradient baru di berkas mana pun
 * tetap gagal.
 */
const GRADIENT_ALLOWLIST = [
  {
    file: 'apps/web/src/app/globals.css',
    insideSelector: '.checkerboard',
    reason: 'peta transparansi 8px Frame Studio (PRD Task 2.5), bukan gradient brand',
  },
];

const ROOT_BEGIN = '/* BEGIN BRAND (generated) */';
const ROOT_END = '/* END BRAND (generated) */';
const THEME_BEGIN = '/* BEGIN BRAND THEME (generated) */';
const THEME_END = '/* END BRAND THEME (generated) */';

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.mjs', '.js', '.svg']);
const SCAN_SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.turbo']);

// ---------------------------------------------------------------------------
// Ramp
// ---------------------------------------------------------------------------

/** Nama custom property CSS, dipetakan ke kunci palette sumbernya. */
const RAMP = [
  ['primary', 'primary', ' = --main'],
  ['primary-strong', 'primaryStrong', ''],
  ['primary-mid', 'primaryMid', ''],
  ['tint', 'tint', ''],
  ['mist', 'mist', ' = --background'],
  ['surface', 'surface', ' = --secondary-background'],
  ['ink', 'ink', ''],
];

function lower(value) {
  return value.toLowerCase();
}

/**
 * Baca `palette` dari literal objek datar di `public.ts`.
 * Sengaja tidak mengimpor TypeScript supaya guard jalan sebelum toolchain apa pun.
 */
export function parsePalette(source) {
  const paletteStart = source.indexOf('palette: {');
  if (paletteStart === -1) {
    throw new Error('Tidak menemukan blok `palette: {` di content/public.ts.');
  }
  const blockStart = source.indexOf('{', paletteStart);
  let depth = 0;
  let blockEnd = -1;
  for (let i = blockStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        blockEnd = i;
        break;
      }
    }
  }
  if (blockEnd === -1) throw new Error('Blok `palette` di content/public.ts tidak tertutup.');

  const body = source.slice(blockStart, blockEnd + 1);
  const palette = {};
  for (const match of body.matchAll(/(\w+):\s*'(#[0-9a-fA-F]{3,8})'/g)) {
    palette[match[1]] = lower(match[2]);
  }
  for (const [cssName, paletteKey] of RAMP) {
    if (!palette[paletteKey]) {
      throw new Error(
        `BRAND.palette tidak punya kunci \`${paletteKey}\` untuk --brand-${cssName}.`,
      );
    }
  }
  return palette;
}

/**
 * Indentasi isi blok yang di-generate.
 *
 * Harus sama dengan indentasi badan `:root` dan `@theme inline` (2 spasi)
 * supaya `prettier --write` tidak mengubah apa pun di dalam blok. Kalau tidak,
 * `format:check` dan `check:brand` akan saling bertabrakan: prettier menulis ulang,
 * lalu guard menganggap hasilnya selisih dan gagal.
 */
const GENERATED_INDENT = '  ';

export function rootBlock(palette) {
  const lines = RAMP.map(
    ([cssName, paletteKey, note]) =>
      `--brand-${cssName}: ${lower(palette[paletteKey])};${note ? ` /*${note} */` : ''}`,
  );
  return [ROOT_BEGIN, ...lines, ROOT_END].map((line) => GENERATED_INDENT + line).join('\n');
}

export function themeBlock() {
  const lines = RAMP.map(([cssName]) => `--color-brand-${cssName}: var(--brand-${cssName});`);
  return [THEME_BEGIN, ...lines, THEME_END].map((line) => GENERATED_INDENT + line).join('\n');
}

// ---------------------------------------------------------------------------
// Pengeditan blok CSS
// ---------------------------------------------------------------------------

/**
 * Rentang teks blok generated, termasuk indentasi baris pembuka.
 *
 * Menyertakan indentasi itu penting: `rootBlock()` menghasilkan blok yang sudah
 * berindentasi, jadi kalau pembacaan melewatkannya, perbandingan tidak pernah
 * bisa sama dan selisih indentasi dari `prettier` jadi tidak terlihat.
 */
function generatedBlockRange(text, begin, end) {
  const marker = text.indexOf(begin);
  if (marker === -1) return null;
  const stop = text.indexOf(end, marker);
  if (stop === -1) return null;
  const lineStart = text.lastIndexOf('\n', marker) + 1;
  const from = text.slice(lineStart, marker).trim() === '' ? lineStart : marker;
  return [from, stop + end.length];
}

function readGeneratedBlock(text, begin, end) {
  const range = generatedBlockRange(text, begin, end);
  return range === null ? null : text.slice(range[0], range[1]);
}

/** Ganti blok generated, atau sisipkan di badan aturan yang cocok kalau belum ada. */
function upsertGeneratedBlock(text, openerPattern, begin, end, block) {
  const range = generatedBlockRange(text, begin, end);
  if (range !== null) {
    // `block` sudah membawa indentasinya sendiri, jadi indentasi lama pada baris
    // yang sama ikut tertimpa. Kalau tidak, setiap `brand:sync` menambah dua
    // spasi dan blok makin lama makin dalam ke kanan.
    return text.slice(0, range[0]) + block + text.slice(range[1]);
  }
  const openerMatch = openerPattern.exec(text);
  if (!openerMatch) return null;
  const bodyStart = text.indexOf('{', openerMatch.index);
  let depth = 0;
  for (let i = bodyStart; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        // Sisipkan tepat setelah `{` pembuka. Isi blok yang ada tidak boleh
        // tersentuh: blok token dibandingkan `check-token-sync`, jadi menjaga
        // isi persis sama adalah syarat, bukan pilihan.
        const at = bodyStart + 1;
        return `${text.slice(0, at)}\n${block}\n${text.slice(at)}`;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pemindaian
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SCAN_SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXTENSIONS.has(path.extname(entry))) out.push(full);
  }
  return out;
}

const HEX_PATTERN = /#[\da-fA-F]{3,8}\b/g;
const GRADIENT_PATTERN = /\b(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/g;

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

/** Rentang karakter [start, end) yang ditutupi satu blok CSS. */
function cssBlockRange(text, openerPattern) {
  const match = openerPattern.exec(text);
  if (!match) return null;
  const bodyStart = text.indexOf('{', match.index);
  let depth = 0;
  for (let i = bodyStart; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return [bodyStart, i + 1];
    }
  }
  return null;
}

export function scanFile(file) {
  const relative = path.relative(root, file);
  const text = readFileSync(file, 'utf8');
  const findings = [];
  const retiredHexExempt = RETIRED_HEX_EXEMPT_FILES.has(relative);

  for (const match of text.matchAll(HEX_PATTERN)) {
    const retired = RETIRED_BRAND_HEXES.get(match[0].toLowerCase());
    if (retired && !retiredHexExempt) {
      findings.push({
        file: relative,
        line: lineOf(text, match.index),
        detail: `${match[0]} (${retired}) sudah dicabut oleh D-01; pakai token brand`,
      });
    }
  }

  const allowedRanges = GRADIENT_ALLOWLIST.filter((entry) => entry.file === relative).map(
    (entry) => {
      const range = cssBlockRange(text, new RegExp(`^\\s*${entry.insideSelector}\\s*\\{`, 'm'));
      return range === null ? null : { range, reason: entry.reason };
    },
  );

  for (const match of text.matchAll(GRADIENT_PATTERN)) {
    const allowed = allowedRanges.some(
      ({ range }) => match.index >= range[0] && match.index < range[1],
    );
    if (!allowed) {
      const allowance = GRADIENT_ALLOWLIST.find((entry) => entry.file === relative);
      findings.push({
        file: relative,
        line: lineOf(text, match.index),
        detail: allowance
          ? `gradient di luar \`${allowance.insideSelector}\`; satu-satunya pengecualian adalah ${allowance.reason}`
          : 'gradient tidak diizinkan di berkas ini; peta transparansi Frame Studio satu-satunya pengecualian',
      });
    }
  }

  return findings;
}

export function scanAll(files) {
  return files.flatMap(scanFile);
}

// ---------------------------------------------------------------------------
// Pemeriksaan kios dan themeColor
// ---------------------------------------------------------------------------

function checkKioskPalette(blueRamp) {
  const text = readFileSync(kioskContractPath, 'utf8');
  const start = text.indexOf('KIOSK_BASE_COLORS');
  if (start === -1)
    return [`${path.relative(root, kioskContractPath)}: KIOSK_BASE_COLORS tidak ditemukan.`];
  const end = text.indexOf('} as const', start);
  const block = text.slice(start, end === -1 ? undefined : end);
  const problems = [];
  for (const match of block.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    if (!blueRamp.has(lower(match[0]))) {
      problems.push(
        `${path.relative(root, kioskContractPath)}: KIOSK_BASE_COLORS memakai ${match[0]}, bukan warna ramp biru. Pakai nilai dari BRAND.palette.`,
      );
    }
  }
  return problems;
}

function checkThemeColor(blueRamp) {
  const match = /themeColor:\s*'(#[0-9a-fA-F]{3,8})'/.exec(readFileSync(rootLayoutPath, 'utf8'));
  if (!match || blueRamp.has(lower(match[1]))) return [];
  return [`${path.relative(root, rootLayoutPath)}: themeColor ${match[1]} bukan warna ramp biru.`];
}

// ---------------------------------------------------------------------------

// Main
// ---------------------------------------------------------------------------

/**
 * Normalkan warna CSS ke heksa 6 digit huruf kecil, atau null bila tidak bisa.
 *
 * Dibutuhkan karena `--main` ditulis `hsl(217, 100%, 66%)` sementara
 * `--brand-primary` ditulis `#5294ff`; keduanya warna yang sama, dan
 * memperbandingkannya sebagai string akan melaporkan kegagalan palsu.
 */
export function normalizeColour(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
  if (hex) {
    const digits = hex[1];
    const full =
      digits.length === 3
        ? digits
            .split('')
            .map((d) => d + d)
            .join('')
        : digits;
    return '#' + full;
  }

  const hsl = /^hsl\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*\)$/.exec(text);
  if (hsl) {
    const [h, s, l] = [Number(hsl[1]) / 360, Number(hsl[2]) / 100, Number(hsl[3]) / 100];
    const a = s * Math.min(l, 1 - l);
    const channel = (n) => {
      const k = (n + h * 12) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return (
      '#' +
      [channel(0), channel(8), channel(4)].map((c) => c.toString(16).padStart(2, '0')).join('')
    );
  }

  // oklch() dan format lain sengaja tidak dinormalkan: masing-masing butuh
  // konversi warna ruang penuh, dan pasangan ramp di sini selalu heksa/hsl.
  return null;
}

/**
 * Kesetaraan ramp yang selama ini hanya ditulis di komentar.
 *
 * Klaim inti keputusan D-01 adalah "satu ramp, bukan dua ramp yang kebetulan
 * biru", dan itu bergantung pada dua pasangan yang harus bernilai sama:
 * `--brand-primary` = `--main`, dan `--brand-mist` = `--background`. Keduanya
 * pernah hanya dijamin komentar, dan satu di antaranya (mist lawan background)
 * memang sudah menyimpang: komentar menulis "= --background" sementara nilainya
 * beda satu digit. `check:token-sync` hanya menuntut kedua berkas CSS identik,
 * bukan bahwa pasangan ini cocok, jadi keduanya bisa pecah dengan guard hijau.
 *
 * Fungsi ini mengubah komentar itu menjadi invarian yang diperiksa.
 */
export function checkRampEqualities(relative, cssText, palette) {
  const problems = [];
  const declared = (name) => {
    const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(cssText);
    return match === null ? null : match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
  };
  const equal = (left, right) => {
    const a = normalizeColour(declared(left));
    const b = normalizeColour(declared(right));
    if (a === null || b === null) return null;
    return a === b;
  };

  // `--main` boleh ditulis sebagai `hsl(...)`, jadi dibandingkan lewat nilai
  // yang sudah dinormalkan: kalau formatnya beda, minta ditulis sama agar
  // kesetaraannya bisa dibaca manusia dan mesin.
  const mainVsBrand = equal('main', 'brand-primary');
  if (mainVsBrand === false) {
    problems.push(
      `${relative}: --main (${declared('main')}) tidak sama dengan --brand-primary ` +
        `(${declared('brand-primary')}). Ramp harus satu: pakai nilai yang sama persis.`,
    );
  }

  const bgVsMist = equal('background', 'brand-mist');
  if (bgVsMist === false) {
    problems.push(
      `${relative}: --background (${declared('background')}) tidak sama dengan --brand-mist ` +
        `(${declared('brand-mist')}). Ramp harus satu: pakai nilai yang sama persis.`,
    );
  }

  return problems;
}

export function collect(palette, files) {
  const problems = [];
  const expectedRoot = rootBlock(palette);
  const expectedTheme = themeBlock();

  for (const cssPath of cssPaths) {
    const relative = path.relative(root, cssPath);
    const text = readFileSync(cssPath, 'utf8');
    if (readGeneratedBlock(text, ROOT_BEGIN, ROOT_END) !== expectedRoot) {
      problems.push(
        `${relative}: blok :root brand tidak cocok dengan BRAND.palette. Jalankan \`pnpm brand:sync\`.`,
      );
    }
    if (readGeneratedBlock(text, THEME_BEGIN, THEME_END) !== expectedTheme) {
      problems.push(
        `${relative}: blok @theme inline brand tidak cocok. Jalankan \`pnpm brand:sync\`.`,
      );
    }
    problems.push(...checkRampEqualities(relative, text, palette));
  }

  for (const finding of scanAll(files)) {
    problems.push(`${finding.file}:${finding.line} — ${finding.detail}`);
  }

  const blueRamp = new Set(RAMP.map(([, key]) => lower(palette[key])));
  problems.push(...checkKioskPalette(blueRamp));
  problems.push(...checkThemeColor(blueRamp));

  return problems;
}

function write() {
  const palette = parsePalette(readFileSync(publicTsPath, 'utf8'));
  for (const cssPath of cssPaths) {
    const relative = path.relative(root, cssPath);
    const original = readFileSync(cssPath, 'utf8');

    // Tiap upsert diperiksa SEGERA. Kalau hasilnya `null` diteruskan dulu,
    // pemanggilan berikutnya membaca `null` dan melempar `TypeError` mentah,
    // sehingga pesan diagnostik yang sebenarnya tidak pernah tampil.
    const withRoot = upsertGeneratedBlock(
      original,
      /^:root\s*\{/m,
      ROOT_BEGIN,
      ROOT_END,
      rootBlock(palette),
    );
    if (withRoot === null) {
      throw new Error(`${relative}: tidak menemukan blok :root untuk disisipi blok brand.`);
    }

    const withTheme = upsertGeneratedBlock(
      withRoot,
      /^@theme inline\s*\{/m,
      THEME_BEGIN,
      THEME_END,
      themeBlock(),
    );
    if (withTheme === null) {
      throw new Error(`${relative}: tidak menemukan blok @theme inline untuk disisipi blok brand.`);
    }

    writeFileSync(cssPath, withTheme);
    process.stdout.write(`Blok brand ditulis ke ${relative}\n`);
  }
}

function main() {
  if (process.argv.includes('--write')) {
    write();
    return;
  }

  const palette = parsePalette(readFileSync(publicTsPath, 'utf8'));
  const files = scanRoots.flatMap((dir) => walk(dir));
  const problems = collect(palette, files);

  if (problems.length > 0) {
    process.stderr.write('Palet brand melanggar keputusan D-01 (biru, tanpa gradient):\n');
    for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
    process.stderr.write(
      '\nPerbaiki ke token brand, atau jalankan `pnpm brand:sync` bila hanya blok CSS\n' +
        'yang belum sinkron.\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    `Palet brand biru konsisten: ${RAMP.length} token di dua berkas CSS, ` +
      `gradient hanya di dalam ${GRADIENT_ALLOWLIST[0].insideSelector}, ` +
      `tidak ada hex brand yang dicabut.\n`,
  );
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
