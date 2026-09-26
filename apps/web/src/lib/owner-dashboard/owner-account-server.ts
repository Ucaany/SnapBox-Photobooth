import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { getDatabase, notifications, users } from '@snapbox/db';
import { requireOwnerTenant } from './outlet-server';

export { requireOwnerTenant };

export async function getOwnerProfile(userId: string) {
  const [profile] = await getDatabase()
    .select({ fullName: users.fullName, email: users.email, phone: users.phone })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, 'OWNER'), isNull(users.deletedAt)))
    .limit(1);
  return profile;
}

export async function listOwnerNotifications(userId: string, tenantId: string) {
  const now = new Date();
  const rows = await getDatabase()
    .select({
      id: notifications.id,
      type: notifications.type,
      severity: notifications.severity,
      title: notifications.title,
      message: notifications.message,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(
      and(
        or(
          and(
            eq(notifications.userId, userId),
            or(isNull(notifications.tenantId), eq(notifications.tenantId, tenantId)),
          ),
          and(isNull(notifications.userId), eq(notifications.tenantId, tenantId)),
        ),
        or(isNull(notifications.expiresAt), gt(notifications.expiresAt, now)),
        gt(notifications.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
