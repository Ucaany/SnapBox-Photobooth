import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const stylesPath = path.join(root, 'packages/ui/src/styles.css');
const globalsPath = path.join(root, 'apps/web/src/app/globals.css');

// Opener yang dicocokkan sebagai prefiks. Opener cocok bila sama persis dengan
// nama ini ATAU diawali `nama + ' '`, sehingga `@utility px-rounded-md` cocok
// dengan `@utility`. Kunci blok memakai opener lengkap, jadi tiga `@utility`
// menjadi tiga kunci berbeda yang dibandingkan terpisah.
const prefixNames = [':root', '@theme inline', '@layer base', '@utility', '@layer components'];

// Batas blok bernama pertama (`:root`), dipakai untuk memisahkan prelude.
// Batasnya memakai baris opener (regex ber-flag m), bukan substring, karena
// kata "utilities" pada komentar juga memuat '@utility' sebagai substring.
const mainOpenPattern = /^:root\b/m;
const preludeLabel = 'prelude (sebelum :root)';
// Baris struktural yang wajar berbeda antar file dan TIDAK dibandingkan.
const preludeIgnore = /^(@source\b|@import\b|@plugin\b)/;

/**
 * Cakupan pemeriksaan blok token, untuk dilaporkan apa adanya.
 *
 * PENTING: daftar ini hanya blok yang WAJIB identik dengan styles.css. Area
 * sisanya — seluruh aturan di luar `@layer` — TIDAK dibandingkan byte-per-byte,
 * karena styles.css memang tidak memuatnya. Angka cakupan dicetak ke stdout
 * supaya angka itu tidak pernah disalahartikan sebagai "seluruh CSS sudah
 * dijaga": pemeriksaan blok token hanya menutup sekitar seperlima berkas.
 *
 * Yang menutup area sisanya ada di bagian var() di bawah dan di
 * scripts/check-css-classes.mjs.
 */
const comparedBlockPattern =
  /^(:root\b|@theme\b|@layer\s+(base|components|utilities|theme)\b|@utility\b)/;

function stripHeadComment(text) {
  return text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
}

function matchPrefix(opener) {
  for (const name of prefixNames) {
    if (opener === name || opener.startsWith(name + ' ')) return name;
  }
  return null;
}

function extract(target) {
  const text = stripHeadComment(target);
  const lines = text.split('\n');
  const blocks = {};

  // Posisi blok bernama pertama (:root), dipakai sebagai batas prelude.
  const mainStart = mainOpenPattern.exec(text);
  const regionStart = mainStart === null ? -1 : mainStart.index;

  // Prelude di antara komentar kepala dan :root. Hanya baris non-struktural
  // (@source/@import/@plugin dikecualikan) yang dibandingkan, supaya @source
  // milik globals.css tidak memicu gagal palsu.
  let prelude = null;
  if (regionStart !== -1) {
    const kept = text
      .slice(0, regionStart)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => line.trim() !== '' && !preludeIgnore.test(line.trim()));
    if (kept.length > 0) prelude = kept.join('\n').trim();
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim().replace(/\s*\{\s*$/, '');
    const name = matchPrefix(raw);
    if (!name) continue;

    let depth = 0;
    const chunk = [];
    for (let j = i; j < lines.length; j++) {
      const line = lines[j];
      for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      chunk.push(line);
      if (depth === 0) {
        i = j;
        break;
      }
    }

    const blockText = chunk.join('\n').trim();
    blocks[raw] = raw in blocks ? `${blocks[raw]}\n\n${blockText}` : blockText;
  }

  return { blocks, prelude };
}

function compare(a, b) {
  const failures = [];

  if (a.prelude !== null || b.prelude !== null) {
    if (a.prelude !== b.prelude) {
      failures.push(`\`${preludeLabel}\` berbeda antara styles.css dan globals.css`);
    }
  }

  const aKeys = Object.keys(a.blocks);
  const bKeys = Object.keys(b.blocks);
  for (const key of aKeys) {
    if (!(key in b.blocks)) {
      failures.push(`blok \`${key}\` ada di styles.css tetapi tidak di globals.css`);
    }
  }
  for (const key of bKeys) {
    if (!(key in a.blocks)) {
      failures.push(`blok \`${key}\` ada di globals.css tetapi tidak di styles.css`);
    }
  }
  for (const key of aKeys) {
    if (key in b.blocks && a.blocks[key] !== b.blocks[key]) {
      failures.push(`blok \`${key}\` berbeda antara styles.css dan globals.css`);
    }
  }

  return failures;
}

/**
 * var() yang tidak punya fallback, dan nama variabelnya.
 *
 * Kenapa fallback diabaikan: `var(--x, 1rem)` TIDAK bisa gagal diam-diam — kalau
 * `--x` tidak ada, nilai `1rem` yang dipakai. Yang berbahaya justru
 * `var(--x)` polos: deklarasinya jadi tidak valid pada computed-value time
 * dan property itu hilang tanpa satu pun pesan. Itu persis kelas defect yang
 * sama: token hilang, utility hilang, atau variabel salah ketik.
 */
function unresolvableVariables(text) {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const declared = new Set(
    [...stripped.matchAll(/(^|[;{])\s*(--[A-Za-z0-9-]+)\s*:/g)].map((match) => match[2]),
  );
  const unresolved = [];

  for (const match of stripped.matchAll(/var\(\s*(--[A-Za-z0-9-]+)\s*([^,)]*)\)/g)) {
    const [, name, tail] = match;
    if (declared.has(name)) continue;
    if (tail.trim() !== '') continue; // punya fallback
    const line = stripped.slice(0, match.index).split('\n').length;
    unresolved.push({ name, line });
  }

  return unresolved;
}

/**
 * Berapa banyak berkas yang benar-benar dibandingkan, dan berapa yang tidak.
 *
 * Fungsi ini tidak beropini tentang apa yang seharusnya dijaga; ia hanya
 * menghitung supaya angkanya terlihat di setiap kali guard ini berjalan.
 */
export function measureCoverage(text) {
  const lines = text.split('\n');
  let compared = 0;
  let blocks = 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (!comparedBlockPattern.test(lines[index])) continue;
    blocks += 1;
    let depth = 0;
    for (let cursor = index; cursor < lines.length; cursor += 1) {
      for (const char of lines[cursor]) {
        if (char === '{') depth += 1;
        else if (char === '}') depth -= 1;
      }
      compared += 1;
      if (depth === 0) {
        index = cursor;
        break;
      }
    }
  }

  return { total: lines.length, compared, blocks, unguarded: lines.length - compared };
}

/**
 * Aturan yang ditulis di luar `@layer` mana pun.
 *
 * Penting untuk keputusan, bukan untuk guard. CSS yang tidak dibungkus
 * `@layer` menang dari layer `utilities` Tailwind pada spesifisitas sama,
 * sehingga utility yang kebetulan bentrok diam-diam kalah. Menghitungnya di
 * sini memberi angka untuk keputusan layer yang disengaja (Fase 1); guard ini
 * sengaja TIDAK memindahkannya, karena memindahkan @layer sekaligus membalik
 * setiap tabrakan sekaligus dan itu harus jadi keputusan, bukan efek samping.
 */
function countUnlayeredRules(text) {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  let depth = 0;
  let rules = 0;

  for (let index = 0; index < stripped.length; index += 1) {
    if (stripped[index] === '{') {
      const prelude = stripped.slice(Math.max(0, stripped.lastIndexOf('}', index) + 1), index);
      if (
        depth === 0 &&
        !/^\s*@(?:media|supports|keyframes|font-face|property|layer|utility|theme)\b/.test(prelude)
      ) {
        rules += 1;
      }
      depth += 1;
    } else if (stripped[index] === '}') {
      depth -= 1;
    }
  }

  return rules;
}

function main() {
  const styles = readFileSync(stylesPath, 'utf8');
  const globals = readFileSync(globalsPath, 'utf8');

  const failures = compare(extract(styles), extract(globals));

  // var() diperiksa pada SELURUH isi kedua berkas, termasuk area yang tidak
  // dibandingkan byte-per-byte di atas. Inilah perluasan yang menutup ~88% berkas
  // yang sebelumnya tidak dijaga apa pun.
  const unresolved = [
    ...unresolvableVariables(styles).map((item) => ({
      ...item,
      label: 'packages/ui/src/styles.css',
    })),
    ...unresolvableVariables(globals).map((item) => ({
      ...item,
      label: 'apps/web/src/app/globals.css',
    })),
  ];

  if (failures.length > 0 || unresolved.length > 0) {
    if (failures.length > 0) {
      process.stderr.write(
        'Token tidak sinkron antara packages/ui/src/styles.css dan apps/web/src/app/globals.css:\n',
      );
      for (const f of failures) process.stderr.write(`  - ${f}\n`);
      process.stderr.write(
        '\nSalin ulang blok token dari styles.css ke globals.css (blok yang dikompilasi web).\n',
      );
    }
    if (unresolved.length > 0) {
      process.stderr.write(
        '\nvar() tanpa fallback yang tidak terdefinisi. Deklarasi menjadi tidak valid ' +
          'pada computed-value time, property-nya hilang, dan tidak ada pesan apa pun:\n',
      );
      for (const item of unresolved) {
        process.stderr.write(`  - ${item.label}:${item.line} var(${item.name})\n`);
      }
      process.stderr.write(
        '\nDeklarasikan variabelnya, atau beri fallback pada var()-nya. Jangan ' +
          'menghapus rujukan hanya agar guard ini diam.\n',
      );
    }
    process.exit(1);
  }

  const coverage = measureCoverage(globals);
  const percent = ((100 * coverage.compared) / coverage.total).toFixed(1);
  process.stdout.write(
    `Token sinkron: ${prefixNames.join(', ')} cocok antara styles.css dan globals.css.\n`,
  );
  process.stdout.write(
    `Cakupan: ${coverage.compared}/${coverage.total} baris globals.css (${percent}%) ` +
      `dibandingkan byte-per-byte di ${coverage.blocks} blok. ` +
      `Sisa ${coverage.unguarded} baris (${(100 - Number(percent)).toFixed(1)}%) tidak ` +
      'dibandingkan dengan styles.css karena tidak ada padanannya; area itu dijaga oleh ' +
      'pemeriksaan var() di atas dan oleh scripts/check-css-classes.mjs.\n',
  );
  process.stdout.write(
    `  ${countUnlayeredRules(globals)} aturan di globals.css ditulis di luar @layer. ` +
      'Keduanya menang dari layer utilities Tailwind pada spesifisitas sama. Guard ini ' +
      'sengaja tidak memindahkannya: memindahkan @layer membalik setiap tabrakan ' +
      'sekaligus, jadi itu keputusan Fase 1, bukan efek samping guard.\n',
  );
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export { extract, compare, mainOpenPattern, preludeLabel, preludeIgnore, prefixNames };
