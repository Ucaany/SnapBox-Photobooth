import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import { getDatabase, tenants, users } from '@snapbox/db';
import { checkEntitlement } from '@/lib/entitlement/entitlement-service';
import { requireOwnerTenant } from './outlet-server';
import type { StaffListRow, StaffQuota } from './staff-contract';

const staffScope = (tenantId: string) =>
  and(
    eq(users.role, 'STAFF'),
    eq(users.tenantId, tenantId),
    eq(users.parentTenantId, tenantId),
    isNull(users.deletedAt),
  );

export { requireOwnerTenant };

export async function listOwnerStaff(tenantId: string): Promise<StaffListRow[]> {
  const rows = await getDatabase()
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      disabled: users.disabled,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(staffScope(tenantId))
    .orderBy(desc(users.disabled), asc(users.fullName));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function staffQuota(tenantId: string): Promise<StaffQuota> {
  const [used] = await getDatabase()
    .select({ value: count(users.id) })
    .from(users)
    .where(and(staffScope(tenantId), eq(users.disabled, false)));
  const entitlement = await checkEntitlement(tenantId, 'staffLimit');
  return {
    used: Number(used?.value ?? 0),
    limit: entitlement.allowed && typeof entitlement.value === 'number' ? entitlement.value : null,
    available:
      entitlement.allowed && typeof entitlement.value === 'number' && entitlement.value !== -1
        ? Math.max(0, entitlement.value - Number(used?.value ?? 0))
        : entitlement.allowed && entitlement.value === -1
          ? null
          : null,
  };
}

export async function ownerCompanyName(tenantId: string): Promise<string> {
  const [tenant] = await getDatabase()
    .select({ companyName: tenants.companyName })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return tenant?.companyName ?? 'tenant SnapBox';
}
