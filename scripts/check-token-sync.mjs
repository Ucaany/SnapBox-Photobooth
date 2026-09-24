import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const stylesPath = path.join(root, 'packages/ui/src/styles.css');
const globalsPath = path.join(root, 'apps/web/src/app/globals.css');

const blockNames = [':root', '@theme inline', '@layer base', '@utility', '@layer components'];

function stripHeadComment(text) {
  return text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
}

function extractBlocks(text) {
  const stripped = stripHeadComment(text);
  const lines = stripped.split('\n');
  const blocks = {};

  for (let i = 0; i < lines.length; i++) {
    const opener = lines[i].trim().replace(/\s*\{\s*$/, '');
    if (!blockNames.includes(opener)) continue;

    const name = opener;
    let depth = 0;
    const chunk = [];
    let started = false;

    for (let j = i; j < lines.length; j++) {
      const line = lines[j];
      for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      chunk.push(line);
      started = true;
      if (started && depth === 0) {
        i = j;
        break;
      }
    }

    const normalized = chunk.join('\n').trim();
    blocks[name] = blocks[name] ? blocks[name] + '\n\n' + normalized : normalized;
  }

  return blocks;
}

function main() {
  const styles = readFileSync(stylesPath, 'utf8');
  const globals = readFileSync(globalsPath, 'utf8');

  const a = extractBlocks(styles);
  const b = extractBlocks(globals);

  const failures = [];

  for (const name of blockNames) {
    const av = a[name];
    const bv = b[name];
    if (av === undefined && bv === undefined) continue;
    if (av === undefined) {
      failures.push(`blok \`${name}\` ada di globals.css tetapi tidak di styles.css`);
      continue;
    }
    if (bv === undefined) {
      failures.push(`blok \`${name}\` ada di styles.css tetapi tidak di globals.css`);
      continue;
    }
    if (av !== bv) {
      failures.push(`blok \`${name}\` berbeda antara styles.css dan globals.css`);
    }
  }

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
    `Token sinkron: ${blockNames.join(', ')} cocok antara styles.css dan globals.css.\n`,
  );
  process.exit(0);
}

main();
