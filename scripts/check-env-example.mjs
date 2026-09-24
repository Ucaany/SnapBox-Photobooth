import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

/**
 * Guard inventaris `.env.example`.
 *
 * BATAS KETAT: berkas ini HANYA membaca `.env.example`. Ia tidak pernah membuka
 * `.env`, `.env.local`, `process.env`, secret GitHub/Vercel, atau penyimpan
 * rahasia mana pun, dan tidak pernah mencetak NILAI variabel. Laporan hanya
 * memuat NAMA variabel, deskripsi pola, dan nomor baris.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const examplePath = path.join(root, '.env.example');

// Inventaris nama variabel wajib (PRD Bab 10.14). Tiap nama harus punya tepat
// satu baris assignment `^NAME=`.
const REQUIRED_NAMES = [
  // PUBLIC (di-inline ke bundle browser, bukan secret).
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_MIDTRANS_CLIENT_KEY',
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  // SERVER_ONLY (jangan pernah masuk bundle browser).
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
  // ENCRYPTION (SECRET server-only).
  'ENCRYPTION_MASTER_KEY',
  'PAIRING_TOKEN_SECRET',
  'LAN_JWT_SECRET',
  'DEVICE_JWT_SECRET',
  // THIRD_PARTY (server only, SECRET).
  'PAKASIR_B2B_API_KEY',
  'PAKASIR_B2B_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  // CLOUDFLARE (server only, SECRET).
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ZONE_ID',
  'TURNSTILE_SECRET_KEY',
  // LINKS (bukan secret).
  'WHATSAPP_SALES_NUMBER',
  // DESKTOP (Vite, bukan Next.js).
  'VITE_SENTRY_DSN',
  'VITE_SENTRY_RELEASE',
];

/**
 * Pola nilai yang menyerupai kredensial asli. Placeholder di `.env.example`
 * sengaja dibuat palsu (`replace-me-...`); kemunculan bentuk di bawah berarti
 * seseorang menempelkan nilai asli. Yang dilaporkan hanya deskripsi + nomor
 * baris, bukan teks yang cocok. `password@` pada URL contoh TIDAK dilarang:
 * itu placeholder yang sah.
 */
const BANNED_PATTERNS = [
  { label: 'bentuk JWT Supabase', re: /eyJhbGciOi/ },
  { label: 'bentuk API key Google/Firebase', re: /AIzaSy/ },
  { label: 'bentuk secret key Stripe', re: /(SK-[A-Za-z0-9]{10,}|sk_live_|sk_test_)/ },
];

// PEM asli multi-baris ditandai baris yang isinya persis header PEM tanpa
// kutip/escape. Bentuk aman (placeholder) memakai kutip ganda dan `\n` literal.
const PEM_HEADER_LINE = /^-----BEGIN (RSA |EC )?PRIVATE KEY-----$/;

/** Kumpulkan semua baris assignment `^NAME=` dari berkas contoh. */
export function assignmentsByName(text) {
  const map = new Map();
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match) continue;
    const name = match[1];
    const entry = map.get(name) ?? { count: 0, lines: [] };
    entry.count += 1;
    entry.lines.push(i + 1);
    map.set(name, entry);
  }
  return map;
}

/** Periksa inventaris nama wajib: hilang atau duplikat. */
export function inventoryFailures(assignments) {
  const failures = [];
  const missing = REQUIRED_NAMES.filter((name) => !assignments.has(name));
  if (missing.length > 0) {
    failures.push(`nama wajib hilang dari .env.example: ${missing.join(', ')}`);
  }
  const duplicates = REQUIRED_NAMES.filter((name) => (assignments.get(name)?.count ?? 0) > 1);
  if (duplicates.length > 0) {
    failures.push(`nama wajib duplikat (lebih dari satu assignment): ${duplicates.join(', ')}`);
  }
  return failures;
}

/** Periksa pola yang menyerupai kredensial asli; laporan tanpa nilai. */
export function bannedPatternFailures(lines) {
  const failures = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { label, re } of BANNED_PATTERNS) {
      if (re.test(line))
        failures.push(`baris ${i + 1}: nilai menyerupai ${label} (nilai tidak dicetak)`);
    }
    if (PEM_HEADER_LINE.test(line.trim())) {
      failures.push(
        `baris ${i + 1}: header PEM asli multi-baris, pakai bentuk kutip dengan \\n literal`,
      );
    }
  }

  // Bentuk khusus FIREBASE_ADMIN_PRIVATE_KEY: harus kutip ganda + `\n` literal
  // (loader packages/auth/src/admin.ts melakukan replace(/\\n/g, '\n')).
  const keyLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('FIREBASE_ADMIN_PRIVATE_KEY='))
      keyLines.push({ line: lines[i], no: i + 1 });
  }
  for (const { line, no } of keyLines) {
    const value = line.slice('FIREBASE_ADMIN_PRIVATE_KEY='.length);
    if (/\n/.test(value)) continue;
    if (!value.startsWith('"') || !line.includes('\\n')) {
      failures.push(
        `baris ${no}: FIREBASE_ADMIN_PRIVATE_KEY harus nilai terkutip dengan \\n literal`,
      );
    }
  }
  return failures;
}

function main() {
  if (!existsSync(examplePath)) {
    console.error('GAGAL: .env.example tidak ditemukan di root repo.');
    process.exit(1);
  }

  const text = readFileSync(examplePath, 'utf8');
  const lines = text.split('\n');

  const failures = [...inventoryFailures(assignmentsByName(text)), ...bannedPatternFailures(lines)];

  if (failures.length > 0) {
    for (const f of failures) console.error('GAGAL: ' + f);
    process.exit(1);
  }

  console.log(
    `OK: inventory .env.example lengkap (${REQUIRED_NAMES.length} nama, tanpa duplikat, tanpa placeholder menyerupai kredensial).`,
  );
}

main();
