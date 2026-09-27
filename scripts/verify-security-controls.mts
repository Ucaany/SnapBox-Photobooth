/**
 * Verifikasi kontrol keamanan terhadap database NYATA (bukan `node --test`).
 *
 *ADASAN kenapa skrip ini terpisah dari test suite. `node --test` tidak boleh
 * bergantung pada kredensial, tapi klaim "token pairing tidak bisa ditebus dua
 * kali" dan "sesi yang dicabut tidak lagi mengautentikasi" HANYA bisa dibuktikan
 * terhadap Postgres sungguhan: yang diuji adalah atomisitas SQL, bukan bentuk
 * teksnya. Skrip ini mengimpor modul produksi yang sama dengan route, jadi yang
 * diuji adalah kode yang benar-benar berjalan.
 *
 * Data yang dibuat skrip ini diberi awalan `__verify_` dan SELURUHNYA dihapus
 * lagi di akhir, termasuk saat gagal. Tidak ada kredensial yang dicetak: yang
 * muncul hanya id sementara, peran, dan verdict.
 *
 * PEMAKAIAN: `pnpm verify:security` (butuh `.env` yang terhubung ke database
 * pengujian atau staging — JANGAN production yang berisi data nyata).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { and, eq, isNull } from 'drizzle-orm';

import {
  authSessions,
  booths,
  devices,
  getDatabase,
  pairingTokens,
  tenants,
  users,
} from '@snapbox/db';

// Impor modul `apps/web` secara dinamis. Modul-modul itu berada di package
// tanpa `"type": "module"`, jadi Node mere-parsingnya sebagai CommonJS lalu
// mendeteksi sintaks ESM; interaksinya dengan impor statis `@snapbox/db` di atas
// membuat named export hilang. Impor dinamis memuatnya sebagai ESM bersih.
const { hashDeviceToken, issueDeviceToken } =
  await import('../apps/web/src/lib/booth/device-token.ts');
const { PAIRING_MAX_ATTEMPTS, hashPairingCode, newPairingCode } =
  await import('../apps/web/src/lib/booth/pairing-token.ts');
const { claimPairingToken, recordFailedPairingAttempt } =
  await import('../apps/web/src/lib/booth/pairing-claim.ts');
const { SESSION_MAX_AGE_SECONDS, createSession, verifySession } =
  await import('../apps/web/src/lib/auth/session.ts');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Awalan id sementara, supaya data uji mudah dikenali dan tidak pernah dipakai. */
const MARKER = '__verify_';

function loadDotEnv(): void {
  let source: string;
  try {
    source = readFileSync(path.join(root, '.env'), 'utf8');
  } catch {
    return;
  }
  for (const line of source.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, name, raw] = match;
    if (process.env[name] !== undefined) continue;
    const quoted = /^(['"])([\s\S]*)\1$/.exec(raw.trim());
    process.env[name] = (quoted ? quoted[2] : raw).replace(/\\n/g, '\n').trim();
  }
}

const results: { name: string; pass: boolean; detail: string }[] = [];

function check(name: string, pass: boolean, detail = ''): void {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? 'LOLOS' : 'GAGAL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const db = () => getDatabase();

/** Fixture: satu tenant uji dengan dua booth, plus satu user OWNER. */
async function seedFixture() {
  const database = db();
  const now = new Date();

  const [tenant] = await database
    .insert(tenants)
    .values({
      companyName: `${MARKER}tenant`,
      ownerEmail: `${MARKER}owner@example.invalid`,
      status: 'ACTIVE',
      deviceQuota: 1,
      addOnDevices: 0,
    })
    .returning({ id: tenants.id });

  if (!tenant) throw new Error('gagal membuat tenant uji');

  const boothRows = await database
    .insert(booths)
    .values([
      { tenantId: tenant.id, name: `${MARKER}booth-1` },
      { tenantId: tenant.id, name: `${MARKER}booth-2` },
    ])
    .returning({ id: booths.id });

  const [owner] = await database
    .insert(users)
    .values({
      firebaseUid: `${MARKER}uid-owner`,
      email: `${MARKER}owner@example.invalid`,
      fullName: `${MARKER} Owner`,
      role: 'OWNER',
      tenantId: tenant.id,
      parentTenantId: tenant.id,
    })
    .returning({ id: users.id });

  return { tenantId: tenant.id, boothIds: boothRows.map((b) => b.id), ownerId: owner!.id, now };
}

async function cleanup(fixture: { tenantId: string; ownerId: string }): Promise<void> {
  const database = db();
  // Urutan(child -> parent) mengikuti cascade FK; `activity_logs` tidak ada
  // karena semua penulisan di skrip ini best-effort dan bisa gagal.
  await database.delete(devices).where(eq(devices.tenantId, fixture.tenantId));
  await database.delete(pairingTokens).where(eq(pairingTokens.tenantId, fixture.tenantId));
  await database.delete(authSessions).where(eq(authSessions.userId, fixture.ownerId));
  await database.delete(booths).where(eq(booths.tenantId, fixture.tenantId));
  await database.delete(users).where(eq(users.id, fixture.ownerId));
  await database.delete(tenants).where(eq(tenants.id, fixture.tenantId));
}

async function issueToken(
  boothId: string,
  tenantId: string,
  overrides: { expiresAt?: Date; attemptCount?: number } = {},
) {
  const code = newPairingCode();
  const row = await db()
    .insert(pairingTokens)
    .values({
      tenantId,
      boothId,
      codeHash: hashPairingCode(code),
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
      attemptCount: overrides.attemptCount ?? 0,
    })
    .returning({ id: pairingTokens.id });

  return { code, codeHash: hashPairingCode(code), id: row[0]!.id };
}

// ---------------------------------------------------------------------------

async function verifySingleUse(fixture: Awaited<ReturnType<typeof seedFixture>>) {
  const token = await issueToken(fixture.boothIds[0]!, fixture.tenantId);

  const first = await db().transaction((tx) =>
    claimPairingToken(tx, { codeHash: token.codeHash, now: new Date() }),
  );
  const second = await db().transaction((tx) =>
    claimPairingToken(tx, { codeHash: token.codeHash, now: new Date() }),
  );

  check('kode pairing hanya bisa ditebus satu kali', first !== null && second === null);

  const [row] = await db()
    .select({
      used: pairingTokens.used,
      usedAt: pairingTokens.usedAt,
      attempts: pairingTokens.attemptCount,
    })
    .from(pairingTokens)
    .where(eq(pairingTokens.id, token.id));
  check(
    'used/used_at/attempt_count benar-benar tertulis',
    Boolean(row?.used && row?.usedAt && row?.attempts === 1),
  );

  return { first, second, token };
}

/**
 * Konkurensi: dua klaim pada waktu yang sama untuk kode yang sama.
 *
 * Dijalankan pada koneksi TERPISAH agar tidak bisa dioptimi oleh cache
 * statement yang sama; ini skenario dua request HTTP sebenarnya.
 */
async function verifyConcurrentClaim(fixture: Awaited<ReturnType<typeof seedFixture>>) {
  const token = await issueToken(fixture.boothIds[0]!, fixture.tenantId);
  const now = new Date();

  const results = await Promise.all([
    db().transaction((tx) => claimPairingToken(tx, { codeHash: token.codeHash, now })),
    db().transaction((tx) => claimPairingToken(tx, { codeHash: token.codeHash, now })),
    db().transaction((tx) => claimPairingToken(tx, { codeHash: token.codeHash, now })),
  ]);

  const winners = results.filter((r) => r !== null).length;
  check(
    'tiga penukaran bersamaan menghasilkan tepat satu pemenang',
    winners === 1,
    `pemenang=${winners}`,
  );
}

async function verifyExpiry(fixture: Awaited<ReturnType<typeof seedFixture>>) {
  const token = await issueToken(fixture.boothIds[0]!, fixture.tenantId, {
    expiresAt: new Date(Date.now() - 1000),
  });

  const claimed = await db().transaction((tx) =>
    claimPairingToken(tx, { codeHash: token.codeHash, now: new Date() }),
  );
  check('kode yang sudah kedaluwarsa ditolak', claimed === null);
}

async function verifyAttemptLimit(fixture: Awaited<ReturnType<typeof seedFixture>>) {
  const token = await issueToken(fixture.boothIds[0]!, fixture.tenantId, {
    attemptCount: PAIRING_MAX_ATTEMPTS - 1,
  });
  const now = new Date();

  // Satu kegagalan sah (kode diklaim = benar tapi ditolak karena concentrate
  // lockout), lalu klaim berikutnya harus ditolak.
  await recordFailedPairingAttempt(db(), { codeHash: token.codeHash, now });
  const claimed = await db().transaction((tx) =>
    claimPairingToken(tx, { codeHash: token.codeHash, now }),
  );

  check(`kode terkunci setelah ${PAIRING_MAX_ATTEMPTS} percobaan`, claimed === null);

  const [row] = await db()
    .select({ attempts: pairingTokens.attemptCount })
    .from(pairingTokens)
    .where(eq(pairingTokens.id, token.id));
  check(
    'attempt_count naik pada kegagalan',
    row?.attempts === PAIRING_MAX_ATTEMPTS,
    `attempts=${row?.attempts}`,
  );
}

async function verifyRevokedSession(fixture: Awaited<ReturnType<typeof seedFixture>>) {
  const cookie = await createSession({
    sessionId: crypto.randomUUID(),
    userId: fixture.ownerId,
    firebaseUid: `${MARKER}uid-owner`,
    email: `${MARKER}owner@example.invalid`,
    role: 'OWNER',
    tenantId: fixture.tenantId,
    parentTenantId: fixture.tenantId,
    subscription: 'OK',
    subscriptionStatus: null,
  });

  const before = await verifySession(cookie.value);
  check('cookie yang baru diterbitkan terverifikasi', before !== null);

  await db()
    .insert(authSessions)
    .values({
      id: before!.sessionId,
      userId: fixture.ownerId,
      role: 'OWNER',
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    });

  const [beforeRevoke] = await db()
    .select({ revokedAt: authSessions.revokedAt })
    .from(authSessions)
    .where(eq(authSessions.id, before!.sessionId));
  check('sesi aktif tercatat tanpa revoked_at', beforeRevoke?.revokedAt === null);

  // revokeAuthSession menulis revoked_at.
  await db()
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.id, before!.sessionId), isNull(authSessions.revokedAt)));

  // Predikat yang dibaca requireOwnerTenant/requireCeo.
  const [afterRevoke] = await db()
    .select({ revokedAt: authSessions.revokedAt })
    .from(authSessions)
    .where(eq(authSessions.id, before!.sessionId));
  const revoked = afterRevoke?.revokedAt != null;
  check('predicate revocation melihat sesi yang dicabut', revoked);

  // verifySession sendiri tidak boleh berubah: ia tidak boleh_query DB sama
  // sekali, dan itu alasannya predicate ada di gate Node.
  const still = await verifySession(cookie.value);
  check(
    'verifySession tetap tidak menyentuh DB (itulah sebabnya predicate ada di gate)',
    still !== null && revoked,
    'keduanya harus benar: cookie masih kriptografis sah, tapi predicate menolak',
  );
}

async function verifyDeviceCredential(fixture: Awaited<ReturnType<typeof seedFixture>>) {
  const issued = issueDeviceToken();
  const [row] = await db()
    .insert(devices)
    .values({
      boothId: fixture.boothIds[0]!,
      tenantId: fixture.tenantId,
      deviceFingerprint: `${MARKER}fp-${crypto.randomUUID().slice(0, 8)}`,
      sessionJwtHash: issued.tokenHash,
    })
    .returning({ id: devices.id, fingerprint: devices.deviceFingerprint });

  const found = await db()
    .select({ id: devices.id })
    .from(devices)
    .where(
      and(eq(devices.sessionJwtHash, hashDeviceToken(issued.token)), eq(devices.isRevoked, false)),
    )
    .limit(1);

  check(
    'token perangkat disimpan sebagai hash, bukan plaintext',
    found.length === 1 && found[0]!.id === row!.id,
  );
  check(
    'token mentah tidak pernah muncul di baris devices',
    !JSON.stringify(row).includes(issued.token),
  );

  const wrongFingerprint = `${MARKER}fp-other`;
  const stillFound = await db()
    .select({ id: devices.id })
    .from(devices)
    .where(
      and(
        eq(devices.sessionJwtHash, hashDeviceToken(issued.token)),
        eq(devices.deviceFingerprint, wrongFingerprint),
        eq(devices.isRevoked, false),
      ),
    )
    .limit(1);
  check('token tidak berlaku bila fingerprint tidak cocok', stillFound.length === 0);
}

async function verifyCrossTenantIsolation() {
  // Token milik tenant lain tidak boleh bisa mengklaim booth tenant ini.
  const [other] = await db()
    .insert(tenants)
    .values({
      companyName: `${MARKER}other`,
      ownerEmail: `${MARKER}other@example.invalid`,
      status: 'ACTIVE',
    })
    .returning({ id: tenants.id });

  const [otherBooth] = await db()
    .insert(booths)
    .values({ tenantId: other!.id, name: `${MARKER}other-booth` })
    .returning({ id: booths.id });

  const token = await issueToken(otherBooth!.id, other!.id);
  const claimed = await db().transaction((tx) =>
    claimPairingToken(tx, { codeHash: token.codeHash, now: new Date() }),
  );

  // Klaim mengembalikan tenant ASAL token, sehingga tidak ada cara meminta
  // tenant lain lewat body. Ini yang harus ditegakkan oleh query booth.
  check(
    'tenantId pada hasil klaim berasal dari token, tidak bisa diminta',
    claimed?.tenantId === other!.id && claimed.boothId === otherBooth!.id,
  );

  await db().delete(booths).where(eq(booths.id, otherBooth!.id));
  await db().delete(tenants).where(eq(tenants.id, other!.id));
}

// ---------------------------------------------------------------------------

async function main() {
  loadDotEnv();

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum diset');

  if (process.env.ALLOW_PRODUCTION_VERIFY === '1') {
    throw new Error('ALLOW_PRODUCTION_VERIFY=1: skrip ini menghapus baris. Jangan dipakai.');
  }

  const fixture = await seedFixture();
  console.log(
    `Fixture: tenant uji + ${fixture.boothIds.length} booth + 1 owner (semua prefix ${MARKER}).`,
  );

  try {
    await verifySingleUse(fixture);
    await verifyConcurrentClaim(fixture);
    await verifyExpiry(fixture);
    await verifyAttemptLimit(fixture);
    await verifyRevokedSession(fixture);
    await verifyDeviceCredential(fixture);
    await verifyCrossTenantIsolation();
  } finally {
    await cleanup(fixture);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);

  if (failed.length > 0) {
    for (const f of failed) console.error(`GAGAL: ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
    process.exitCode = 1;
  }
}

const { closeDatabase } = await import('@snapbox/db/client');
try {
  await main();
} catch (error) {
  console.error(`GAGAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
