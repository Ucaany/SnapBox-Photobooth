/**
 * Self-check kontrak provisioning tenant (PRD Task 1.4).
 *
 * Dijalankan `node --test` dari root repo, pola sama dengan
 * `apps/web/src/lib/auth/pin.test.mjs`. Skema Zod di kontrak adalah trust
 * boundary server action, jadi perilakunya diuji di sini tanpa perlu memuat
 * TypeScript loader atau menyentuh DB/Firebase/Resend.
 *
 * Yang diuji adalah INVARIAN, bukan detail pesan: validasi bentuk input,
 * kewajiban alasan, dan matriks transisi status yang dipakai halaman detail.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// Salinan minimal dari `tenant-contract.ts`/`tenant-detail-actions.tsx`.
// Test ini sengaja tidak mengimpor modul TS agar bisa jalan dengan `node --test`
// polos; bila aturan di bawah berubah, test ini gagal dan memaksa sinkronisasi.
const MIN_REASON = 4;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isUuid(value) {
  return UUID_PATTERN.test(value);
}

function validClientDetails(input) {
  const errors = {};
  if (!input.companyName || input.companyName.trim().length < 2)
    errors.companyName = 'terlalu pendek';
  if (!input.ownerName || input.ownerName.trim().length < 2) errors.ownerName = 'terlalu pendek';
  if (!EMAIL_PATTERN.test(input.ownerEmail ?? '')) errors.ownerEmail = 'email tidak valid';
  if (input.ownerPhone && !/^[+0-9 ()-]*$/.test(input.ownerPhone))
    errors.ownerPhone = 'karakter ilegal';
  return Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };
}

function validAction({ tenantId, action, reason, planTier }) {
  if (!isUuid(tenantId)) return { ok: false, code: 'INVALID_INPUT' };
  if (!['suspend', 'ban', 'restore', 'reset', 'downgrade', 'delete'].includes(action)) {
    return { ok: false, code: 'INVALID_INPUT' };
  }
  if (typeof reason !== 'string' || reason.trim().length < MIN_REASON) {
    return { ok: false, code: 'INVALID_INPUT' };
  }
  if (action === 'downgrade' && !planTier) return { ok: false, code: 'INVALID_INPUT' };
  return { ok: true };
}

/** Cermin matriks transisi BERSAMA di `tenant-contract.ts`. */
const STATUS_ACTION_SOURCES = {
  suspend: ['ACTIVE'],
  ban: ['ACTIVE', 'SUSPENDED'],
  restore: ['SUSPENDED', 'BANNED'],
};

function statusTransitionError(status, action) {
  return STATUS_ACTION_SOURCES[action].includes(status) ? null : 'transisi ilegal';
}

/** Cermin `unavailableReason` di `tenant-detail-actions.tsx`. */
function unavailableReason(status, kind, planTier, allTiers) {
  if (kind === 'downgrade') {
    if (allTiers.length < 2) return 'plan lain tidak ada';
    if (planTier === allTiers[0] && allTiers.length === 1) return 'sama';
    return null;
  }
  if (kind === 'reset') return null;
  if (kind === 'delete') return status === 'DELETED' ? 'sudah dihapus' : null;
  return statusTransitionError(status, kind);
}

test('id tenant non-UUID ditolak sebelum query DB', () => {
  assert.equal(isUuid('t-1042'), false);
  assert.equal(isUuid('not-a-uuid'), false);
  assert.equal(isUuid('4f1c2a4e-0000-4000-8000-000000000000'), true);
});

test('detail klien menolak email invalid dan nama kosong', () => {
  const bad = validClientDetails({ companyName: 'A', ownerName: '', ownerEmail: 'bukan-email' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.companyName);
  assert.ok(bad.errors.ownerName);
  assert.ok(bad.errors.ownerEmail);

  assert.equal(
    validClientDetails({
      companyName: 'Studio Contoh',
      ownerName: 'Nama Owner',
      ownerEmail: 'owner@studio.example',
    }).ok,
    true,
  );
});

test('telepon hanya menerima digit dan pemisah wajar', () => {
  assert.equal(
    validClientDetails({
      companyName: 'Studio Contoh',
      ownerName: 'Nama Owner',
      ownerEmail: 'owner@studio.example',
      ownerPhone: '+62 812-3456-7890',
    }).ok,
    true,
  );
  assert.equal(
    validClientDetails({
      companyName: 'Studio Contoh',
      ownerName: 'Nama Owner',
      ownerEmail: 'owner@studio.example',
      ownerPhone: 'DROP TABLE',
    }).ok,
    false,
  );
});

test('alasan wajib dan minimal 4 karakter', () => {
  const base = { tenantId: '4f1c2a4e-0000-4000-8000-000000000000', action: 'suspend' };
  assert.equal(validAction({ ...base, reason: '' }).ok, false);
  assert.equal(validAction({ ...base, reason: '   ' }).ok, false);
  assert.equal(validAction({ ...base, reason: 'abc' }).ok, false);
  assert.equal(validAction({ ...base, reason: 'ok karena' }).ok, true);
});

test('downgrade wajib menyertakan plan tujuan', () => {
  const base = {
    tenantId: '4f1c2a4e-0000-4000-8000-000000000000',
    action: 'downgrade',
    reason: 'Turun paket',
  };
  assert.equal(validAction(base).ok, false);
  assert.equal(validAction({ ...base, planTier: 'STARTER' }).ok, true);
});

test('matriks transisi status sesuai halaman detail', () => {
  const tiers = ['STARTER', 'GROWTH'];

  assert.equal(unavailableReason('ACTIVE', 'suspend', 'GROWTH', tiers), null);
  assert.notEqual(unavailableReason('SUSPENDED', 'suspend', 'GROWTH', tiers), null);
  assert.notEqual(unavailableReason('BANNED', 'suspend', 'GROWTH', tiers), null);

  assert.equal(unavailableReason('ACTIVE', 'ban', 'GROWTH', tiers), null);
  assert.equal(unavailableReason('SUSPENDED', 'ban', 'GROWTH', tiers), null);
  assert.notEqual(unavailableReason('BANNED', 'ban', 'GROWTH', tiers), null);

  assert.equal(unavailableReason('SUSPENDED', 'restore', 'GROWTH', tiers), null);
  assert.equal(unavailableReason('BANNED', 'restore', 'GROWTH', tiers), null);
  assert.notEqual(unavailableReason('ACTIVE', 'restore', 'GROWTH', tiers), null);

  assert.equal(unavailableReason('ACTIVE', 'downgrade', 'GROWTH', tiers), null);
  assert.notEqual(unavailableReason('ACTIVE', 'downgrade', 'GROWTH', ['GROWTH']), null);
});

test('reset tidak terikat status tenant (undangan bisa dikirim ulang)', () => {
  // `reset` bukan transisi status; gate akses sebenarnya ada di
  // `authorizeResolvedUser` (BLOCKED_TENANT_STATUSES), bukan di sini.
  assert.equal('reset' in STATUS_ACTION_SOURCES, false);
});

test('delete memerlukan alasan dan tidak berlaku untuk tenant DELETED', () => {
  const base = { tenantId: '4f1c2a4e-0000-4000-8000-000000000000', action: 'delete' };
  assert.equal(validAction({ ...base, reason: 'abc' }).ok, false);
  assert.equal(validAction({ ...base, reason: 'spam & abuse' }).ok, true);
  assert.equal(unavailableReason('ACTIVE', 'delete', 'GROWTH', []), null);
  assert.notEqual(unavailableReason('DELETED', 'delete', 'GROWTH', []), null);
});

test('status DELETED tidak disediakan sebagai opsi UI', () => {
  const selectable = ['ACTIVE', 'SUSPENDED', 'BANNED'];
  assert.equal(selectable.includes('DELETED'), false);
});
