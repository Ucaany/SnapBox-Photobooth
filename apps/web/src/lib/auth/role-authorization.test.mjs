/**
 * Guard RBAC berbasis peran (D-04, ADR-009, opsi B "hapus modul").
 *
 * Modul permission pernah ada dengan 75 izin dan nol importer. Modul yang
 * menggantung lebih berbahaya dari yang tidak pernah ada, karena ia memberi
 * kesan kontrol sudah ada. Guard ini mengunci tiga hal:
 *
 * 1. Modul permission TIDAK BOLEH muncul kembali tanpa keputusan RBAC baru.
 * 2. `/staff-dashboard` TIDAK BOLEH dibangun. roadstead ini yang sebenarnya
 *    menjaga Staff: begitu route itu ada, satu-satunya penghalang antara sesi
 *    Staff dan aksi destruktif kelas Owner adalah satu `requireOwnerTenant()`
 *    per aksi, 41 di antaranya, tanpa test.
 * 3. Setiap server action yang名前 'use server' harus melewati gerbang.
 *    Ini menutup kelas defect "aksi baru tanpa cek", bukan hanya insidennya.
 *
 * Dijalankan `node --test` dari root repo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  '..',
);
const appDir = path.join(root, 'apps', 'web', 'src', 'app');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const sharedAuth = read('packages/shared/src/auth.ts');
const routePolicy = read('apps/web/src/lib/auth/route-policy.ts');

/** Semua berkas 'use server' di repo. */
function serverActionModules() {
  return fs
    .readdirSync(appDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => fs.readFileSync(file, 'utf8').startsWith("'use server'"));
}

test('modul permission granular tidak boleh kembali tanpa keputusan baru', () => {
  for (const banned of [
    'export const PERMISSIONS',
    'ROLE_PERMISSIONS',
    'export function hasPermission',
    'export function canAccessTenant',
    'ROLE_HOME_ROUTE',
  ]) {
    assert.ok(!sharedAuth.includes(banned), `packages/shared/src/auth.ts masih punya ${banned}`);
  }

  // Catatan kenapa modul ini dihapus wajib tetap ada di tempatnya; kalau tidak,
  // penyunting berikutnya akan menyimpulkan modul ini belum pernah dipakai dan
  // menambahkan permission lagi.
  assert.match(sharedAuth, /ADR-009/);
});

test('/staff-dashboard tidak boleh dibangun', () => {
  const staffDashboard = path.join(appDir, 'staff-dashboard');
  assert.ok(
    !fs.existsSync(staffDashboard),
    'apps/web/src/app/staff-dashboard ada. Dilarang sebelum keputusan RBAC baru (D-04).',
  );

  // Staff tidak boleh punya tujuan rute yang valid: `safeHomeForRole`
  // mengembalikan `null`, jadi login PIN dan middleware berakhir di
  // `/unauthorized`, bukan mengarahkan Staff ke halaman apa pun.
  assert.match(
    routePolicy,
    /role === 'CEO' \? '\/ceo-dashboard' : role === 'OWNER' \? '\/owner-dashboard' : null/,
  );

  // Peta prefix di `route-policy.ts` boleh tetap menyebut `/staff-dashboard`:
  // itu DEKLARASI rute yang belum ada, bukan izin akses. Yang dijaga adalah
  // bahwa larangan eksplisit tertulis di sebelahnya, dan `safeHomeForRole` tidak
  // pernah mengarahkan Staff ke sana.
  assert.match(routePolicy, /tidak boleh dibangun sebelum ada keputusan RBAC baru/);
  assert.doesNotMatch(
    routePolicy,
    /safeHomeForRole[\s\S]{0,400}staff-dashboard/,
    'safeHomeForRole tidak boleh punya tujuan /staff-dashboard',
  );
});

test('PRD menyatakan restrição yang sama', () => {
  const prd = read(
    'PRD_SnapBox_Photobooth_Platform_SaaS_Manajemen_Photobooth_Multi-Tenant_Kiosk_Desktop.md',
  );
  assert.match(prd, /Staff Dashboard \(Read-Only\) — \*\*TIDAK DIBANGUN/);
  assert.match(
    prd,
    /AMENDEMEN 2026-09-27 \(D-04\):\*\* redirect ke `\/staff-dashboard` \*\*tidak\*\*/,
  );
  // Permission dicoret sebagai kontrol akses, bukan hanya diberi tanda.
  assert.match(prd, /75 permission ini ada di `packages\/shared\/src\/auth\.ts` dengan/);
});

test('setiap modul use server melewati gerbang otorisasi', () => {
  const modules = serverActionModules();
  assert.ok(modules.length > 0, 'tidak ada modul use server yang ditemukan — guard ini basi');

  const GATES = [
    'requireOwnerTenant(',
    'requireCeo(',
    'authorizeResolvedUser(',
    'findActiveStaffByEmail(',
  ];

  /**
   * true bila modul ini, atau modul `use server` yang di-import-nya, memanggil
   * gerbang. Satu hop indireksi diperbolehkan karena pola "actions.ts tipis yang
   * mendelegasikan ke actions.ts lain" dipakai di repo ini; tanpa itu guard akan
   * salah menuduh delegasi yang sah.
   */
  function reachesGate(file, seen = new Set()) {
    if (seen.has(file)) return false;
    seen.add(file);

    const source = fs.readFileSync(file, 'utf8');
    if (GATES.some((gate) => source.includes(gate))) return true;

    for (const specifier of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
      if (!specifier[1].startsWith('.')) continue;
      // Specifier tanpa ekstensi: repo ini tidak menulis `.ts` di import.
      const base = path.resolve(path.dirname(file), specifier[1]);
      const target = fs.existsSync(base) ? base : `${base}.ts`;
      if (fs.existsSync(target) && reachesGate(target, seen)) return true;
    }

    return false;
  }

  for (const file of modules) {
    if (!reachesGate(file)) {
      throw new Error(
        `${path.relative(root, file)} tidak memanggil gerbang otorisasi apa pun (${GATES.join(', ')}), langsung maupun lewat delegasi.`,
      );
    }
  }
});
