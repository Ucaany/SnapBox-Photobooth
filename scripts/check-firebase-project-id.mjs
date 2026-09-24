import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'supabase', 'config.toml');

function topLevelProjectId(toml) {
  let inSection = false;
  for (const raw of toml.split('\n')) {
    const line = raw.trim();
    if (/^\[/.test(line)) {
      inSection = true;
      continue;
    }
    if (!inSection) {
      const m = line.match(/^project_id\s*=\s*"([^"]*)"\s*$/);
      if (m) return m[1];
    }
  }
  return null;
}

function firebaseProjectId(toml) {
  let inSection = false;
  for (const raw of toml.split('\n')) {
    const line = raw.trim();
    if (/^\[/.test(line)) {
      inSection = line === '[auth.third_party.firebase]';
      continue;
    }
    if (inSection) {
      const m = line.match(/^project_id\s*=\s*"([^"]*)"\s*$/);
      if (m) return m[1];
    }
  }
  return null;
}

function main() {
  const toml = readFileSync(configPath, 'utf8');
  const top = topLevelProjectId(toml);
  const firebase = firebaseProjectId(toml);
  const env = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (top === null) {
    console.error(`GAGAL: project_id top-level tidak ditemukan di ${configPath}`);
    process.exit(1);
  }
  if (firebase === null) {
    console.error('GAGAL: project_id di [auth.third_party.firebase] tidak ditemukan.');
    process.exit(1);
  }

  const failures = [];

  if (top !== firebase) {
    failures.push(
      `project_id top-level ("${top}") berbeda dengan [auth.third_party.firebase] ("${firebase}").`,
    );
  }

  if (env) {
    if (env !== firebase) {
      failures.push(
        `NEXT_PUBLIC_FIREBASE_PROJECT_ID ("${env}") berbeda dengan [auth.third_party.firebase] ("${firebase}").`,
      );
    }
  } else {
    console.log(
      'CATATAN: NEXT_PUBLIC_FIREBASE_PROJECT_ID tidak diset; pemeriksaan terhadap env dilewati.',
    );
  }

  if (failures.length > 0) {
    for (const f of failures) console.error(`GAGAL: ${f}`);
    process.exit(1);
  }

  console.log(
    `OK: project_id konsisten (top-level = firebase = "${firebase}")${
      env ? ` dan cocok dengan env ("${env}")` : ''
    }.`,
  );
}

main();
