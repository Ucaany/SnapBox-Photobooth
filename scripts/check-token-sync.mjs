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

function main() {
  const styles = readFileSync(stylesPath, 'utf8');
  const globals = readFileSync(globalsPath, 'utf8');

  const failures = compare(extract(styles), extract(globals));

  if (failures.length > 0) {
    process.stderr.write(
      'Token tidak sinkron antara packages/ui/src/styles.css dan apps/web/src/app/globals.css:\n',
    );
    for (const f of failures) process.stderr.write(`  - ${f}\n`);
    process.stderr.write(
      '\nSalin ulang blok token dari styles.css ke globals.css (blok yang dikompilasi web).\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    `Token sinkron: ${prefixNames.join(', ')} cocok antara styles.css dan globals.css.\n`,
  );
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export { extract, compare, mainOpenPattern, preludeLabel, preludeIgnore, prefixNames };
