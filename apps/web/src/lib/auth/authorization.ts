/**
 * Otorisasi server SnapBox: verifikasi Firebase, baca DB, bangun sesi.
 *
 * Ini satu-satunya tempat keputusan otorisasi login dibuat. Middleware Edge dan
 * komponen klien TIDAK boleh mereplikasi logika ini; keduanya hanya boleh
 * membaca snapshot sesi. `tenant_id` selalu berasal dari DB baris `users`,
 * bukan dari claim atau body permintaan (PRD Bab 5.5).
 *
 * HANYA untuk runtime Node (`runtime = 'nodejs'`): modul ini menarik
 * `@snapbox/auth/admin` (firebase-admin) dan `@snapbox/db` (postgres).
 */
import { and, desc, eq, isNull, ne } from 'drizzle-orm';

import { toCustomClaims } from '@snapbox/auth';
import { verifyIdToken } from '@snapbox/auth/admin';
import { getDatabase, b2bSubscriptions, booths, tenants, users } from '@snapbox/db';
import type { SubscriptionStatus, UserRole } from '@snapbox/shared/domain';

import type { SessionInput, SubscriptionGate } from './session';

/**
 * Status langganan yang dianggap memberi akses.
 *
 * `EXPIRING` dan `GRACE_PERIOD` sengaja lolos: keduanya masih masa berlaku sah
 * menurut state machine PRD Bab 6.J. `PENDING` tidak lolos karena pembayaran
 * belum terkonfirmasi webhook.
 */
const USABLE_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'ACTIVE',
  'EXPIRING',
  'GRACE_PERIOD',
];

/** Status tenant yang memblokir login. */
const BLOCKED_TENANT_STATUSES: readonly string[] = ['SUSPENDED', 'BANNED', 'DELETED'];

/** Error otorisasi dengan pesan yang aman ditampilkan (tanpa detail sensitif). */
export class AuthorizationError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Ringkasan langganan tenant: gate untuk keputusan, status untuk pesan UI. */
export interface SubscriptionEvaluation {
  readonly gate: SubscriptionGate;
  readonly status: SubscriptionStatus | null;
}

/**
 * Mengevaluasi langganan tenant.
 *
 * Ambil baris langganan terbaru yang relevan, lalu putuskan gate. "Gate" adalah
 * keputusan otorisasi; "status" hanya untuk pesan. Keduanya dikembalikan
 * bersama supaya pemanggil tidak perlu menafsir ulang.
 *
 * @param tenantId Tenant pemilik langganan.
 * @param nowMs Waktu sekarang, dapat diganti untuk test.
 */
export async function evaluateSubscription(
  tenantId: string,
  nowMs: number = Date.now(),
): Promise<SubscriptionEvaluation> {
  const db = getDatabase();
  const now = new Date(nowMs);

  const [latest] = await db
    .select({
      status: b2bSubscriptions.status,
      validUntil: b2bSubscriptions.validUntil,
      gracePeriodUntil: b2bSubscriptions.gracePeriodUntil,
    })
    .from(b2bSubscriptions)
    .where(eq(b2bSubscriptions.tenantId, tenantId))
    .orderBy(desc(b2bSubscriptions.createdAt))
    .limit(1);

  if (!latest) {
    return { gate: 'UNKNOWN', status: null };
  }

  if (!USABLE_SUBSCRIPTION_STATUSES.includes(latest.status)) {
    return { gate: 'BLOCKED', status: latest.status };
  }

  // `validUntil` null pada langganan ACTIVE yang belum punya tanggal berarti
  // durasi belum ditetapkan; perlakukan sebagai belum bisa diverifikasi.
  if (!latest.validUntil) {
    return { gate: 'UNKNOWN', status: latest.status };
  }

  // GRACE_PERIOD dinilai dari batas grace, status lain dari validUntil.
  const deadline =
    latest.status === 'GRACE_PERIOD' && latest.gracePeriodUntil
      ? latest.gracePeriodUntil
      : latest.validUntil;

  if (deadline.getTime() <= now.getTime()) {
    return { gate: 'BLOCKED', status: latest.status };
  }

  return { gate: 'OK', status: latest.status };
}

/** Baris `users` + status tenant yang sudah dinormalisasi. */
export interface ResolvedUser {
  readonly userId: string;
  readonly firebaseUid: string;
  readonly email: string;
  readonly role: UserRole;
  readonly tenantId: string | null;
  readonly parentTenantId: string | null;
  readonly tenantStatus: string | null;
}

/**
 * Mencari user aktif di `users` berdasarkan UID Firebase.
 *
 * Semua langganan aktif dibaca sekaligus supaya gate OWNER/STAFF bisa diputuskan
 * tanpa query kedua. User dengan `disabled = true` atau `deleted_at` terisi
 * dianggap tidak ada.
 *
 * @returns Baris user, atau `null` bila tidak ada.
 */
export async function findActiveUserByFirebaseUid(
  firebaseUid: string,
): Promise<ResolvedUser | null> {
  const db = getDatabase();

  const [row] = await db
    .select({
      userId: users.id,
      firebaseUid: users.firebaseUid,
      email: users.email,
      role: users.role,
      tenantId: users.tenantId,
      parentTenantId: users.parentTenantId,
      tenantStatus: tenants.status,
    })
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(
      and(eq(users.firebaseUid, firebaseUid), eq(users.disabled, false), isNull(users.deletedAt)),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Mencari user STAFF aktif berdasarkan email, untuk jalur PIN.
 *
 * Hanya peran STAFF yang diterima; Owner/CEO harus lewat kata sandi Firebase.
 * `tenantId` nullable di skema, sehingga baris tanpa tenant tidak bisa dipakai
 * (tidak ada booth untuk memverifikasi PIN).
 */
export async function findActiveStaffByEmail(email: string): Promise<ResolvedUser | null> {
  const db = getDatabase();

  const [row] = await db
    .select({
      userId: users.id,
      firebaseUid: users.firebaseUid,
      email: users.email,
      role: users.role,
      tenantId: users.tenantId,
      parentTenantId: users.parentTenantId,
      tenantStatus: tenants.status,
    })
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(
      and(
        eq(users.email, email),
        eq(users.role, 'STAFF'),
        eq(users.disabled, false),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Mengevaluasi user hasil lookup terhadap tenant + langganannya.
 *
 * Fungsi ini adalah SATU-SATUNYA tempat keputusan tenant/langganan dibuat.
 * Pemanggil DILARANG menambahkan pemeriksaan pendahulu sendiri (mis. menolak
 * lebih dulu karena `tenantId` null), karena setiap jalan keluar awal berarti
 * satu kelas user melewati pemeriksaan status tenant.
 *
 * Urutan pemeriksaan sengaja: status tenant diperiksa SEBELUM kelengkapan
 * `tenantId`. Tenant yang suspend/ban/hapus harus ditolak sebagai tenant
 * terblokir, bukan sebagai "akun tidak punya tenant", agar pesan internal dan
 * audit tidak salah kategori saat alur suspend menonaktifkan asosiasi tenant.
 *
 * @throws {AuthorizationError} Bila tenant diblokir, tidak terhubung, atau
 *   langganannya tidak aktif.
 */
export async function authorizeResolvedUser(
  user: ResolvedUser,
  nowMs: number = Date.now(),
): Promise<SubscriptionEvaluation> {
  // CEO tidak terikat tenant dan tidak dikendalikan langganan.
  if (user.role === 'CEO') {
    return { gate: 'OK', status: null };
  }

  if (user.tenantStatus && BLOCKED_TENANT_STATUSES.includes(user.tenantStatus)) {
    throw new AuthorizationError('TENANT_BLOCKED', 'Akses tenant diblokir.');
  }

  if (!user.tenantId) {
    throw new AuthorizationError('TENANT_MISSING', 'Akun tidak terhubung ke tenant.');
  }

  const subscription = await evaluateSubscription(user.tenantId, nowMs);

  if (subscription.gate !== 'OK') {
    throw new AuthorizationError(
      'SUBSCRIPTION_INACTIVE',
      'Langganan tenant tidak aktif.',
      // Bukan kesalahan autentikasi: identitas sah, otorisasi yang menolak.
      403,
    );
  }

  return subscription;
}

/**
 * Memverifikasi ID token Firebase lalu membangun isi sesi.
 *
 * Langkah lengkap (semuanya wajib, tidak ada yang bisa dilewati):
 * 1. `verifyIdToken` menolak token palsu/kedaluwarsa/project lain.
 * 2. Claim `app_role` dibaca lewat `toCustomClaims` (BUKAN claim Postgres `role`).
 * 3. Baris `users` dicari berdasarkan UID; akun di luar DB tidak diberi sesi.
 * 4. Role claim harus sama dengan role DB; ketidakcocokan berarti claim basi dan
 *    login ditolak sampai claim diperbarui (ADR-003 konsekuensi (b)).
 * 5. Tenant didapat dari DB, bukan dari claim, sehingga pembelokan tenant di
 *    token tidak berpengaruh.
 *
 * @param idToken ID token mentah dari Firebase Client SDK.
 * @throws {AuthorizationError} Untuk semua penolakan otorisasi.
 * @throws Error Untuk kegagalan Firebase (token invalid/expired).
 */
export async function buildSessionFromIdToken(idToken: string): Promise<SessionInput> {
  const decoded = await verifyIdToken(idToken);

  let claims: ReturnType<typeof toCustomClaims>;
  try {
    claims = toCustomClaims(decoded);
  } catch {
    throw new AuthorizationError('CLAIMS_INVALID', 'Token tidak memuat peran aplikasi yang sah.');
  }

  const user = await findActiveUserByFirebaseUid(decoded.uid);
  if (!user) {
    throw new AuthorizationError('USER_NOT_FOUND', 'Akun tidak ditemukan atau tidak aktif.');
  }

  // Claim basi: token menyebut peran lain daripada DB. Menolak lebih aman
  // daripada memilih salah satu diam-diam.
  if (claims.appRole !== user.role) {
    throw new AuthorizationError('CLAIMS_STALE', 'Peran token tidak sinkron dengan data akun.');
  }

  const subscription = await authorizeResolvedUser(user);

  return {
    userId: user.userId,
    firebaseUid: user.firebaseUid,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    parentTenantId: user.parentTenantId,
    subscription: subscription.gate,
    subscriptionStatus: subscription.status,
  };
}

/**
 * Mencatat waktu login terakhir.
 *
 * Dipanggil setelah cookie berhasil diterbitkan, dan kegagalannya TIDAK
 * menggagalkan login: ini telemetri, bukan otorisasi.
 */
export async function touchLastLogin(userId: string, nowMs: number = Date.now()): Promise<void> {
  try {
    const db = getDatabase();
    await db
      .update(users)
      .set({ lastLoginAt: new Date(nowMs), updatedAt: new Date(nowMs) })
      .where(eq(users.id, userId));
  } catch {
    // Sengaja ditelan: login yang sudah sah tidak boleh gagal karena audit.
  }
}

/**
 * Mencari booth tenant yang PIN-nya cocok.
 *
 * PIN operator disimpan per booth (`booths.operator_pin_hash`), jadi satu staff
 * bisa punya PIN berbeda antar booth. Untuk login web, PIN dianggap sah bila
 * cocok dengan SALAH SATU booth aktif milik tenant staff tersebut.
 *
 * Query mengambil kandidat hash lebih dulu, lalu verifikasi scrypt dijalankan
 * berurutan dengan `break` pada kecocokan pertama. Jumlah booth per tenant kecil,
 * dan iterasi penuh akan memperlambat login secara sia-sia.
 *
 * @param tenantId Tenant staff; PIN tenant lain tidak boleh berlaku.
 * @param pin PIN 6 digit.
 * @param verify Fungsi verifikasi disuntik agar modul ini tidak mengimpor
 *   `./pin` (menjaga batas modul server tetap jelas).
 * @returns `true` bila ada booth yang cocok.
 */
export async function tenantHasMatchingOperatorPin(
  tenantId: string,
  pin: string,
  verify: (pin: string, storedHash: string | null) => boolean,
): Promise<boolean> {
  const db = getDatabase();

  const rows = await db
    .select({ pinHash: booths.operatorPinHash })
    .from(booths)
    .where(
      and(
        eq(booths.tenantId, tenantId),
        eq(booths.maintenanceMode, false),
        ne(booths.status, 'UNPAIRED'),
      ),
    )
    .limit(25);

  const hashes = rows.filter((row) => Boolean(row.pinHash));

  for (const row of hashes) {
    if (verify(pin, row.pinHash)) return true;
  }

  return false;
}
