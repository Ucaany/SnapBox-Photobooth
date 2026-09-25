/**
 * Utilitas server provisioning tenant (PRD Task 1.4).
 *
 * Semua keputusan otorisasi dan akses DB untuk modul tenant ada di sini agar
 * server action tetap tipis. Modul ini HANYA untuk server: ia menarik
 * `@snapbox/db`, `@snapbox/auth/admin`, dan `next/headers`.
 *
 * Aturan yang mengikat:
 * - Otorisasi diulang ke DB setiap aksi (ADR-004); snapshot cookie bisa basi.
 * - Hanya role `CEO` yang boleh provisioning/mutasi tenant.
 * - Resource yang tidak ada ATAU di luar jangkauan ditutup sebagai 404, bukan
 *   403, supaya keberadaan tenant tidak bocor (PRD Bab 5.5).
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';

import {
  getDatabase,
  activityLogs,
  b2bSubscriptions,
  booths,
  plans,
  tenants,
  users,
} from '@snapbox/db';
import type { PlanFeatures } from '@snapbox/db';
import { SESSION_COOKIE_NAME, verifySession, type SessionPayload } from '@/lib/auth/session';

import type { TenantPlanOption } from './tenant-contract';

/** Error yang menandai respons HTTP aman untuk client. */
export class TenantServerError extends Error {
  readonly code: 'UNAUTHORIZED' | 'NOT_FOUND';
  readonly httpStatus: number;

  constructor(code: 'UNAUTHORIZED' | 'NOT_FOUND', message: string) {
    super(message);
    this.name = 'TenantServerError';
    this.code = code;
    this.httpStatus = code === 'UNAUTHORIZED' ? 401 : 404;
  }
}

/** Bentuk UUID kanonik; satu-satunya tempat pola ini ditulis. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Memastikan pemanggil adalah CEO aktif.
 *
 * Dua lapis: cookie sesi yang sah, lalu baris `users` di DB. Lapis kedua
 * penting karena role di cookie bisa basi setelah perubahan peran di DB.
 *
 * @throws {TenantServerError} `UNAUTHORIZED` bila bukan CEO.
 */
export async function requireCeo(): Promise<SessionPayload> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE_NAME)?.value);

  if (!session) {
    throw new TenantServerError('UNAUTHORIZED', 'Sesi tidak valid. Masuk ulang sebagai CEO.');
  }

  const db = getDatabase();
  const [row] = await db
    .select({ role: users.role, disabled: users.disabled, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!row || row.disabled || row.deletedAt || row.role !== 'CEO') {
    throw new TenantServerError('UNAUTHORIZED', 'Aksi ini hanya untuk CEO.');
  }

  return session;
}

/**
 * Mengambil tenant berdasarkan id.
 *
 * Pemeriksaan UUID ada DI SINI, bukan hanya di halaman, supaya tidak ada
 * pemanggil yang bisa mengirim string non-UUID ke PostgreSQL dan mendapat cast
 * error mentah alih-alih 404. Id yang tidak ada, terhapus, atau tidak berbentuk
 * UUID semuanya menjadi `NOT_FOUND` yang sama sehingga keberadaan tenant tidak
 * bocor lewat perbedaan respons (PRD Bab 5.5).
 *
 * @throws {TenantServerError} `NOT_FOUND` bila id bukan UUID, atau tenant tidak
 *   ada/terhapus.
 */
export async function getTenantByIdOr404(tenantId: string) {
  if (!UUID_PATTERN.test(tenantId)) {
    throw new TenantServerError('NOT_FOUND', 'Tenant tidak ditemukan.');
  }

  const db = getDatabase();
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
    .limit(1);

  if (!tenant) {
    throw new TenantServerError('NOT_FOUND', 'Tenant tidak ditemukan.');
  }

  return tenant;
}

/** Plan canonical dari DB; `null` bila plan tidak ada/nonaktif. */
export async function getActivePlan(tier: TenantPlanOption['tier']) {
  const db = getDatabase();
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.tier, tier), eq(plans.isActive, true)))
    .limit(1);

  return plan ?? null;
}

/** Semua plan aktif untuk langkah "Plan & Duration". */
export async function listPlanOptions(): Promise<readonly TenantPlanOption[]> {
  const db = getDatabase();
  const rows = await db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(plans.priceMonthly);

  return rows.map((row) =>
    toPlanOption(row.tier, row.name, row.priceMonthly, row.priceYearly, row.features),
  );
}

/** Ringkasan plan untuk review; dipakai juga oleh action setelah commit. */
export function toPlanOption(
  tier: TenantPlanOption['tier'],
  name: string,
  priceMonthly: string,
  priceYearly: string | null,
  features: PlanFeatures,
): TenantPlanOption {
  return {
    tier,
    name,
    priceMonthly: Number(priceMonthly),
    priceYearly: priceYearly === null ? null : Number(priceYearly),
    deviceIncluded: features.deviceIncluded,
    staffLimit: features.staffLimit,
    storageMb: features.storageMb,
    retentionDays: features.retentionDays,
  };
}

/** Owner (role OWNER) aktif milik tenant, bila ada. */
export async function findTenantOwner(tenantId: string) {
  const db = getDatabase();
  const [owner] = await db
    .select({
      id: users.id,
      firebaseUid: users.firebaseUid,
      email: users.email,
      fullName: users.fullName,
      disabled: users.disabled,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.role, 'OWNER'), isNull(users.deletedAt)))
    .orderBy(desc(users.createdAt))
    .limit(1);

  return owner ?? null;
}

/** Riwayat langganan tenant, terbaru lebih dulu. */
export async function listTenantSubscriptions(tenantId: string, limit = 10) {
  const db = getDatabase();
  return db
    .select()
    .from(b2bSubscriptions)
    .where(eq(b2bSubscriptions.tenantId, tenantId))
    .orderBy(desc(b2bSubscriptions.createdAt))
    .limit(limit);
}

/** Booth tenant, terbaru lebih dulu. */
export async function listTenantBooths(tenantId: string, limit = 25) {
  const db = getDatabase();
  return db
    .select({
      id: booths.id,
      name: booths.name,
      locationTag: booths.locationTag,
      status: booths.status,
      lastHeartbeatAt: booths.lastHeartbeatAt,
      maintenanceMode: booths.maintenanceMode,
    })
    .from(booths)
    .where(eq(booths.tenantId, tenantId))
    .orderBy(desc(booths.createdAt))
    .limit(limit);
}

/** Jejak audit tenant untuk panel detail, terbaru lebih dulu. */
export async function listTenantActivity(tenantId: string, limit = 15) {
  const db = getDatabase();
  return db
    .select({
      id: activityLogs.id,
      actorEmail: activityLogs.actorEmail,
      actorRole: activityLogs.actorRole,
      action: activityLogs.action,
      reason: activityLogs.reason,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .where(eq(activityLogs.tenantId, tenantId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

export interface AuditInput {
  readonly actorUserId: string;
  readonly actorEmail: string;
  readonly tenantId: string | null;
  readonly action: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly reason?: string | null;
  /** Metadata TIDAK boleh memuat tautan undangan, Firebase UID, atau secret. */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Menulis satu baris audit.
 *
 * Kegagalan audit TIDAK boleh membatalkan mutasi yang sudah sah: ini telemetri
 * kepatuhan, bukan otorisasi. Karena itu error ditelan, sama seperti
 * `touchLastLogin`.
 */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    const db = getDatabase();
    await db.insert(activityLogs).values({
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      actorRole: 'CEO',
      tenantId: input.tenantId,
      action: input.action,
      resourceType: input.resourceType ?? 'tenant',
      resourceId: input.resourceId ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? null,
    });
  } catch {
    // Sengaja ditelan; lihat dokumentasi di atas.
  }
}

/** Tag audit untuk aksi provisioning tenant. */
export const TENANT_AUDIT_ACTIONS = {
  create: 'tenant.create',
  suspend: 'tenant.suspend',
  ban: 'tenant.ban',
  restore: 'tenant.restore',
  resetInvite: 'tenant.reset_invite',
  downgrade: 'tenant.downgrade',
} as const;
