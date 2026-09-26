import { and, count, desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { b2bSubscriptions, devices, getDatabase, plans, tenants, users } from '@snapbox/db';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session';
import { checkEntitlement, loadEntitlementContext } from '@/lib/entitlement/entitlement-service';
import { isSubscriptionUsable } from '@/lib/entitlement/entitlement-contract';

export interface OwnerLayoutData {
  readonly ownerName: string;
  readonly planName: string | null;
  readonly deviceUsage: number;
  readonly deviceQuota: number | null;
}

export async function getOwnerLayoutData(
  options: { allowInactiveSubscription?: boolean } = { allowInactiveSubscription: true },
): Promise<OwnerLayoutData> {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE_NAME)?.value);

  if (!session) redirect('/login?next=/owner-dashboard');

  const db = getDatabase();
  const [owner] = await db
    .select({
      fullName: users.fullName,
      tenantId: users.tenantId,
      role: users.role,
      disabled: users.disabled,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!owner || owner.role !== 'OWNER' || owner.disabled || owner.deletedAt || !owner.tenantId) {
    redirect('/unauthorized');
  }

  const [tenant] = await db
    .select({ id: tenants.id, status: tenants.status, deletedAt: tenants.deletedAt })
    .from(tenants)
    .where(eq(tenants.id, owner.tenantId))
    .limit(1);

  if (!tenant || tenant.deletedAt || tenant.status !== 'ACTIVE') redirect('/unauthorized');

  const [[subscription], [deviceCount], quota, entitlementContext] = await Promise.all([
    db
      .select({ planName: plans.name })
      .from(b2bSubscriptions)
      .innerJoin(plans, eq(b2bSubscriptions.planId, plans.id))
      .where(eq(b2bSubscriptions.tenantId, tenant.id))
      .orderBy(desc(b2bSubscriptions.createdAt))
      .limit(1),
    db
      .select({ value: count(devices.id) })
      .from(devices)
      .where(and(eq(devices.tenantId, tenant.id), eq(devices.isRevoked, false))),
    checkEntitlement(tenant.id, 'deviceQuota'),
    loadEntitlementContext(tenant.id).catch(() => null),
  ]);

  if (
    !options.allowInactiveSubscription &&
    !isSubscriptionUsable(entitlementContext?.subscription ?? null)
  ) {
    redirect('/owner-dashboard/subscription');
  }

  return {
    ownerName: owner.fullName,
    planName: subscription?.planName ?? null,
    deviceUsage: Number(deviceCount?.value ?? 0),
    deviceQuota: quota.allowed && typeof quota.value === 'number' ? quota.value : null,
  };
}
