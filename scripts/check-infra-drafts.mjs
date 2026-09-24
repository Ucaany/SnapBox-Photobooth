import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cloudflareDir = path.join(root, 'infra', 'cloudflare');

// Path yang diizinkan menurut PRD 8.2. Dipakai dua arah dengan kesetaraan path
// eksak: tidak boleh ada path liar di draft rate-limit, dan tidak boleh ada path
// PRD yang kehilangan rule. Jumlah rule juga diperiksa terhadap EXPECTED_RULE_COUNT.
const PRD_82_PATHS = [
  '/api/webhooks/',
  '/api/auth/',
  '/api/booth/',
  '/api/payment/create',
  '/api/contact',
  '/api/operator/',
  '/api/pairing/',
];

const EXPECTED_RULE_COUNT = 8;

const JSON_FILES = ['rate-limit-rules.json', 'waf-custom-rules.json', 'turnstile-widget.json'];

// Ambil semua nilai string di dalam objek/array secara rekursif.
function collectStrings(value, out = []) {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

// Normalisasi: buang trailing `*` supaya `/api/webhooks/*` jadi `/api/webhooks/`.
function normalize(p) {
  return p.replace(/\*+$/, '');
}

// Cari literal `/api/...` di dalam seluruh string.
function extractApiPaths(value) {
  const found = new Set();
  for (const s of collectStrings(value)) {
    const matches = s.match(/\/api\/[A-Za-z0-9_\-/.*]*/g) || [];
    for (const m of matches) found.add(normalize(m));
  }
  return found;
}

function readJson(relName, failures) {
  const full = path.join(cloudflareDir, relName);
  if (!existsSync(full)) {
    failures.push(`${relName} tidak ditemukan di infra/cloudflare/`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(full, 'utf8'));
  } catch (err) {
    failures.push(`${relName} gagal di-parse sebagai JSON: ${err.message}`);
    return null;
  }
}

function main() {
  const failures = [];

  if (!existsSync(cloudflareDir)) {
    console.error(`GAGAL: direktori ${cloudflareDir} tidak ditemukan.`);
    process.exit(1);
  }

  for (const relName of JSON_FILES) readJson(relName, failures);

  const readme = path.join(cloudflareDir, 'README.md');
  if (!existsSync(readme)) {
    failures.push('README.md tidak ditemukan di infra/cloudflare/');
  }

  const rateLimit = readJson('rate-limit-rules.json', []);
  if (rateLimit) {
    const jsonPaths = extractApiPaths(rateLimit);

    // Arah 1: tidak boleh ada path di JSON yang di luar allowlist PRD 8.2.
    const drift = [];
    for (const p of jsonPaths) {
      const known = PRD_82_PATHS.some((prd) => p.startsWith(prd));
      if (!known) drift.push(p);
    }
    if (drift.length > 0) {
      failures.push(`path di rate-limit-rules.json tidak ada di PRD 8.2: ${drift.join(', ')}`);
    }

    // Arah 2: setiap path PRD 8.2 harus punya rule (kesetaraan path eksak).
    const missing = PRD_82_PATHS.filter((prd) => !jsonPaths.has(prd));
    if (missing.length > 0) {
      failures.push(`rule rate-limit hilang untuk path PRD 8.2: ${missing.join(', ')}`);
    }

    // Jumlah rule harus persis sesuai PRD 8.2 supaya penulisan ulang parsial
    // (sebagian rule hilang) tetap ketahuan.
    if (Array.isArray(rateLimit.rules) && rateLimit.rules.length !== EXPECTED_RULE_COUNT) {
      failures.push(
        `jumlah rule rate-limit ${rateLimit.rules.length}, seharusnya ${EXPECTED_RULE_COUNT} sesuai PRD 8.2`,
      );
    }

    // Setiap rule harus punya name yang unik dan tidak kosong.
    if (Array.isArray(rateLimit.rules)) {
      const seenNames = new Set();
      for (const rule of rateLimit.rules) {
        const name = rule && typeof rule.name === 'string' ? rule.name.trim() : '';
        if (name === '') {
          failures.push('ada rule rate-limit tanpa name');
          continue;
        }
        if (seenNames.has(name)) {
          failures.push(`name rule rate-limit duplikat: ${name}`);
        }
        seenNames.add(name);
      }
    }
  }

  if (failures.length > 0) {
    for (const f of failures) console.error(`GAGAL: ${f}`);
    process.exit(1);
  }

  console.log(
    `OK: draft Cloudflare lengkap (${JSON_FILES.length} JSON + README.md) dan path rate-limit cocok dengan PRD 8.2.`,
  );
}

main();
