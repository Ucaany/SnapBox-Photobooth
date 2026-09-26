import { and, count, eq, sql } from 'drizzle-orm';
import { booths, getDatabase, outlets, tenants, transactions, users } from '@snapbox/db';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session';
import { checkEntitlement } from '@/lib/entitlement/entitlement-service';
import { outletIdSchema, type OutletDetail, type OutletListRow } from './outlet-contract';

export async function requireOwnerTenant() {
  const { cookies } = await import('next/headers');
  const session = await verifySession((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;
  const db = getDatabase();
  const [owner] = await db
    .select({
      tenantId: users.tenantId,
      role: users.role,
      disabled: users.disabled,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!owner || owner.role !== 'OWNER' || owner.disabled || owner.deletedAt || !owner.tenantId)
    return null;
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(
      and(
        eq(tenants.id, owner.tenantId),
        eq(tenants.status, 'ACTIVE'),
        sql`${tenants.deletedAt} is null`,
      ),
    )
    .limit(1);
  return tenant ? { session, tenantId: tenant.id } : null;
}

export async function listOwnerOutlets(
  tenantId: string,
  includeInactive = false,
): Promise<OutletListRow[]> {
  const db = getDatabase();
  const rows = await db
    .select({
      id: outlets.id,
      name: outlets.name,
      address: outlets.address,
      picName: outlets.picName,
      picPhone: outlets.picPhone,
      latitude: outlets.latitude,
      longitude: outlets.longitude,
      isActive: outlets.isActive,
      boothCount: count(booths.id),
    })
    .from(outlets)
    .leftJoin(booths, and(eq(booths.outletId, outlets.id), eq(booths.tenantId, tenantId)))
    .where(
      and(eq(outlets.tenantId, tenantId), includeInactive ? sql`true` : eq(outlets.isActive, true)),
    )
    .groupBy(outlets.id)
    .orderBy(outlets.name);
  return rows.map((row) => ({ ...row, boothCount: Number(row.boothCount) }));
}

export async function outletQuota(tenantId: string) {
  const [used] = await getDatabase()
    .select({ value: count(outlets.id) })
    .from(outlets)
    .where(eq(outlets.tenantId, tenantId));
  const entitlement = await checkEntitlement(tenantId, 'outletLimit');
  return {
    used: Number(used?.value ?? 0),
    limit: entitlement.allowed && typeof entitlement.value === 'number' ? entitlement.value : null,
  };
}

export async function getOwnerOutlet(tenantId: string, id: string): Promise<OutletDetail | null> {
  if (!outletIdSchema.safeParse(id).success) return null;
  const db = getDatabase();
  const [outlet] = await db
    .select({
      id: outlets.id,
      name: outlets.name,
      address: outlets.address,
      picName: outlets.picName,
      picPhone: outlets.picPhone,
      latitude: outlets.latitude,
      longitude: outlets.longitude,
      isActive: outlets.isActive,
      createdAt: outlets.createdAt,
    })
    .from(outlets)
    .where(and(eq(outlets.id, id), eq(outlets.tenantId, tenantId)))
    .limit(1);
  if (!outlet) return null;
  const linkedBooths = await db
    .select({
      id: booths.id,
      name: booths.name,
      status: booths.status,
      locationTag: booths.locationTag,
    })
    .from(booths)
    .where(and(eq(booths.outletId, id), eq(booths.tenantId, tenantId)))
    .orderBy(booths.name);
  const [sales] = await db
    .select({
      transactionCount: count(transactions.id),
      total: sql<string>`coalesce(sum(${transactions.finalAmount}), 0)`,
    })
    .from(transactions)
    .innerJoin(
      booths,
      and(
        eq(booths.id, transactions.boothId),
        eq(booths.outletId, id),
        eq(booths.tenantId, tenantId),
      ),
    )
    .where(and(eq(transactions.tenantId, tenantId), eq(transactions.paymentStatus, 'PAID')));
  return {
    ...outlet,
    createdAt: outlet.createdAt.toISOString(),
    boothCount: linkedBooths.length,
    booths: linkedBooths,
    sales: {
      transactionCount: Number(sales?.transactionCount ?? 0),
      total: String(sales?.total ?? '0'),
    },
  };
}
