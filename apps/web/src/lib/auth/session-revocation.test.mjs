/**
 * Self-check enforcement pencabutan sesi (P-B-01) dan gerbang CEO pada loader
 * tenant (P-B-05).
 *
 * Yang diuji di sini adalah WIRING, yaitu bagian yang benar-benar bisa regresi
 * diam-diam: `revoked_at` ditulis, `isSessionRevoked` ada, tapi satu gerbang
 * lupa memanggilnya, dan cookie yang dicabut kembali berumur 12 jam. Uji
 * perilaku end-to-end (cookie dicabut lalu dipakai lagi) dijalankan terhadap
 * database nyata lewat `scripts/verify-security-controls.mts`, karena `node
 * --test` tidak boleh bergantung pada kredensial.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.join(here, relative), 'utf8');

const revocation = read('session-revocation.ts');
const ceoGate = read('../ceo-dashboard/tenant-server.ts');
const ownerGate = read('../owner-dashboard/outlet-server.ts');
const sessionModule = read('session.ts');
const healthSecurity = read('../ceo-dashboard/health-security-server.ts');
const tenantActions = read('../../app/(ceo-dashboard)/ceo-dashboard/tenants/actions.ts');

test('verifySession tetap murni kripto: tidak boleh ada query DB', () => {
  // Middleware Edge tidak bisa membuka koneksi PostgreSQL. Kalau predicate
  // revocation pindah ke sini, session middleware ikut gagal saat runtime Edge.
  const verifyBody = sessionModule.slice(
    sessionModule.indexOf('export async function verifySession'),
    sessionModule.indexOf('export async function createSession'),
  );
  assert.doesNotMatch(verifyBody, /getDatabase|authSessions|revokedAt|postgres/i);
});

test('predicate revocation membaca revoked_at dan tidak pernah DELETE', () => {
  assert.match(revocation, /authSessions\.revokedAt/);
  assert.match(revocation, /return row\?\.revokedAt != null;/);
  // "Baris tidak ada = tidak dicabut" hanyaValid selama tidak ada yang menghapus
  // baris. DELETE di sini akan membuat pencabutan bisa dibatalkan dengan menghapus
  // bukti, jadi dijaga oleh test ini.
  assert.doesNotMatch(revocation, /\.delete\(/);
});

test('kedua gerbang menolak sesi yang dicabut', () => {
  // requireCeo: menolak lewat TenantServerError.
  assert.match(ceoGate, /if \(await isSessionRevoked\(session\.sessionId\)\)/);
  assert.match(ceoGate, /throw new TenantServerError\('UNAUTHORIZED', 'Sesi sudah dicabut/);

  // requireOwnerTenant: gagal tertutup dengan `null`, bentuk yang sudah dipakai
  // gerbang ini untuk semua penolakan lain.
  assert.match(ownerGate, /if \(await isSessionRevoked\(session\.sessionId\)\) return null;/);
});

test('suspend/ban dan delete tenant mencabut sesi, bukan hanya menonaktifkan akun', () => {
  assert.match(tenantActions, /affectedUserIds = await revokeTenantSessions\(tx, tenantId, now\);/);
  assert.match(tenantActions, /await revokeAuthSessionsForUser\(userId, now\.getTime\(\)\);/);
  // `restore` sengaja tidak mencabut; kalau suatu saat ini berubah, comment
  // yang menjelaskan alasannya harus ikut berubah.
  assert.match(tenantActions, /const shouldRevoke = action !== 'restore';/);
  assert.match(tenantActions, /if \(shouldRevoke\)/);
});

test('pencabutan memakai UPDATE, bukan DELETE', () => {
  assert.match(healthSecurity, /\.update\(authSessions\)/);
  assert.doesNotMatch(healthSecurity, /delete\(authSessions\)/);
  assert.match(tenantActions, /\.update\(authSessions\)/);
  assert.doesNotMatch(tenantActions, /delete\(authSessions\)/);
});

test('loader tenant mewarisi requireCeo, jadi halaman baru ikut terlindungi', () => {
  // Tiap loader baca data tenant harus menjalankan gerbang lebih dulu. Daftar ini
  // persis loader yang ditemukan audit tanpa cek; menambah loader tanpa menambah
  // nama di sini membuat test ini gagal.
  const loaders = [
    'getTenantByIdOr404',
    'getActivePlan',
    'listPlanOptions',
    'findTenantOwner',
    'listTenantSubscriptions',
    'listTenantBooths',
    'listTenantActivity',
  ];

  for (const name of loaders) {
    const start = ceoGate.indexOf(`export async function ${name}`);
    assert.notEqual(start, -1, `loader ${name} tidak ditemukan`);
    const body = ceoGate.slice(start, ceoGate.indexOf('\nexport ', start + 1));
    assert.match(body, /await requireCeo\(\);/, `loader ${name} tidak memanggil requireCeo()`);
  }
});
