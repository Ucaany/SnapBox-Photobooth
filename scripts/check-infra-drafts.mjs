/**
 * Guard draf Cloudflare.
 *
 * PERUBAHAN 2026-09-27 (D-12, ADR-019). Versi lama memvalidasi path di
 * `rate-limit-rules.json` terhadap ALLOWLIST PRD, bukan terhadap codebase. Itu
 * sebabnya lima dari delapan aturan bisa menunjuk endpoint yang tidak pernah ada
 * tanpa satu pun kegagalan: allowlist itu hanya berisi apa yang SHOULD ADA,
 * bukan apa yang ADA. Guard ini membalik arahnya — sumber kebenaran adalah
 * berkas `route.ts` di bawah `apps/web/src/app/api/`.
 *
 * Yang dijaga:
 * 1. Setiap path yang disebut draf harus cocok dengan setidaknya satu route NYATA.
 * 2. README tidak boleh memverifikasi lewat path yang tidak ada (runbook yang
 *    laporan negatif palsu lebih buruk dari tidak ada runbook).
 * 3. Tidak ada aturan yang bergantung pada Worker/Transform Rule yang tidak ada.
 *    Aturan seperti itu tidak bisa cocok sama sekali, dan "ada di repo" terbaca
 *    sebagai "aktif" saat benar-benar deployed.
 * 4. Karakteristik berbasis header dilarang: di edge nilainya dikendalikan
 *    penyerang. Dimensi identitas ditegakkan di aplikasi.
 *
 * Dijalankan lewat `pnpm check:infra-drafts` (dipakai CI
 * lewat pipeline yang sama).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cloudflareDir = path.join(root, 'infra', 'cloudflare');
const apiDir = path.join(root, 'apps', 'web', 'src', 'app', 'api');

const JSON_FILES = ['rate-limit-rules.json', 'waf-custom-rules.json'];

/**
 * Route yang-party framework, bukan berkas di repo.
 *
 * `tunnelRoute` di `next.config.ts` membuat Sentry menghasilkan route handler
 * `/monitoring-tunnel` saat build. Tidak ada `page.tsx`/`route.ts`-nya di disk,
 * jadi tanpa daftar ini guard akan menandai draf yang BENAR sebagai salah.
 */
const FRAMEWORK_ROUTES = new Set(['/monitoring-tunnel']);

/**
 * Kunci yang isinya murni penjelasan, bukan target.
 *
 * `$removed` pada `rate-limit-rules.json` justru MEBUTUHKAN path yang tidak ada:
 * di situ dicatat aturan mana yang dihapus dan kenapa. Memindainya sebagai target
 * akan membuat draf tidak bisa menjelaskan kegagalannya sendiri.
 */
const METADATA_KEYS = new Set(['$removed', '$endpoints', '$verification']);

/** Route API yang benar-benar ada, sebagai path yang diawali `/`. */
function realApiRoutes(dir = apiDir, prefix = '/api') {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return realApiRoutes(full, `${prefix}/${entry}`);
    // `page.tsx` di bawah `api/` bukan endpoint; hanya `route.ts` yang dieksekusi.
    if (entry !== 'route.ts') return [];
    return [prefix];
  });
}

const ROUTES = new Set(realApiRoutes());

/** Normalisasi: buang `*` dan garis miring di ujung supaya perbandingan eksak. */
function normalize(p) {
  return p.replace(/\*+$/, '').replace(/\/+$/, '') || '/';
}

/** Kumpulkan string, kecuali yang ada di bawah kunci metadata. */
function collectStrings(value, out = [], inMetadata = false) {
  if (typeof value === 'string') {
    if (!inMetadata) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, inMetadata);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [childKey, item] of Object.entries(value)) {
      // Sifat metadata MEWARISI ke seluruh subtree, bukan hanya satu tingkat.
      collectStrings(item, out, inMetadata || METADATA_KEYS.has(childKey));
    }
  }
  return out;
}

/** Semua literal `/api/...` di dalam draf. */
function extractApiPaths(value) {
  const found = new Set();
  for (const text of collectStrings(value)) {
    for (const match of text.match(/\/api\/[A-Za-z0-9_\-/*.]*/g) ?? []) {
      // Buang tanda baca di ekor (`/api/auth/session.` dari kalimat), dan
      // placeholder elipsis seperti `/api/...` yang bukan path nyata.
      const cleaned = normalize(match)
        .replace(/[.,;:)]+$/, '')
        .replace(/\.{2,}$/, '');
      if (cleaned === '/api') found.add(cleaned);
      else if (cleaned.length > '/api/'.length) found.add(cleaned);
    }
  }
  return found;
}

/** Path yang juga disebut tapi BUKAN `/api/...` (mis. `/monitoring-tunnel`). */
function extractAbsolutePaths(value) {
  const found = new Set();
  for (const text of collectStrings(value)) {
    for (const match of text.match(/(?<![\w.$-])\/[a-z0-9][A-Za-z0-9_\-/*.]*/g) ?? []) {
      if (!match.startsWith('/api/')) found.add(normalize(match));
    }
  }
  return found;
}

function pathMatchesRoute(draftPath, routes = ROUTES) {
  if (FRAMEWORK_ROUTES.has(draftPath)) return true;
  return [...routes].some((route) => route === draftPath || route.startsWith(`${draftPath}/`));
}

function readJson(name, failures) {
  const file = path.join(cloudflareDir, name);
  if (!existsSync(file)) {
    failures.push(`${name} tidak ditemukan di infra/cloudflare/`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${name} gagal di-parse sebagai JSON: ${error.message}`);
    return null;
  }
}

function main() {
  const failures = [];

  if (!existsSync(cloudflareDir)) {
    console.error(`GAGAL: direktori ${cloudflareDir} tidak ditemukan.`);
    process.exit(1);
  }

  const parsed = new Map(JSON_FILES.map((name) => [name, readJson(name, failures)]));

  if (ROUTES.size === 0) {
    console.error(
      'GAGAL: tidak ada route API yang ditemukan; guard ini akan salah secara diam-diam.',
    );
    process.exit(1);
  }

  // 1. Setiap path `/api/...` di draf harus cocok route nyata.
  for (const [name, value] of parsed) {
    if (!value) continue;

    for (const draftPath of extractApiPaths(value)) {
      if (!pathMatchesRoute(draftPath)) {
        failures.push(`${name} menunjuk path yang tidak ada di codebase: ${draftPath}`);
      }
    }

    // Path non-API juga harus nyata, tapi hanya yang terlihat seperti rute
    // aplikasi (`/monitoring-tunnel`), bukan path eksternal atau URL.
    for (const draftPath of extractAbsolutePaths(value)) {
      if (draftPath.includes('*')) continue;
      if (FRAMEWORK_ROUTES.has(draftPath)) continue;
      const full = path.join(root, 'apps', 'web', 'src', 'app', draftPath);
      const asFile = `${full}.tsx`;
      const asPage = path.join(full, 'page.tsx');
      if (!existsSync(full) && !existsSync(asFile) && !existsSync(asPage)) {
        failures.push(`${name} menunjuk path yang tidak ada di codebase: ${draftPath}`);
      }
    }
  }

  const rateLimit = parsed.get('rate-limit-rules.json');
  if (rateLimit) {
    const rules = Array.isArray(rateLimit.rules) ? rateLimit.rules : [];
    if (rules.length === 0) failures.push('rate-limit-rules.json tidak punya rule sama sekali.');

    const seen = new Set();
    for (const rule of rules) {
      const name = typeof rule?.name === 'string' ? rule.name.trim() : '';
      if (name === '') {
        failures.push('ada rule rate-limit tanpa name');
        continue;
      }
      if (seen.has(name)) failures.push(`name rule rate-limit duplikat: ${name}`);
      seen.add(name);

      // 3. Aturan yang butuh komponen yang tidak ada tidak bisa cocok.
      for (const marker of ['$requiresWorker', '$requiresTransform']) {
        if (rule[marker] !== undefined) {
          failures.push(
            `rule ${name} masih ditandai ${marker}; komponen itu tidak ada di repo sehingga aturan tidak akan pernah cocok.`,
          );
        }
      }

      // 4. Karakteristik berbasis header berarti identitas dikendalikan penyerang.
      for (const characteristic of rule?.ratelimit?.characteristics ?? []) {
        if (typeof characteristic === 'string' && characteristic.includes('http.request.headers')) {
          failures.push(
            `rule ${name} memakai karakteristik header (${characteristic}); di edge nilainya bisa diputar penyerang.`,
          );
        }
      }
    }
  }

  // 2. README tidak boleh menyuruh operator menguji path yang tidak ada.
  const readmePath = path.join(cloudflareDir, 'README.md');
  if (!existsSync(readmePath)) {
    failures.push('README.md tidak ditemukan di infra/cloudflare/');
  } else {
    const readme = readFileSync(readmePath, 'utf8');
    for (const mentioned of extractApiPaths(readme)) {
      if (!pathMatchesRoute(mentioned)) {
        failures.push(
          `README.md memverifikasi lewat path yang tidak ada: ${mentioned} (prosedur akan melaporkan negatif palsu)`,
        );
      }
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`GAGAL: ${failure}`);
    process.exit(1);
  }

  console.log(
    `OK: draf Cloudflare cocok dengan codebase (${ROUTES.size} route API nyata, ${rateLimit?.rules?.length ?? 0} rule rate-limit).`,
  );
}

main();
