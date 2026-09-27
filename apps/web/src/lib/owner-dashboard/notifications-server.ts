import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { getDatabase, notifications } from '@snapbox/db';
import {
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_RETENTION_DAYS,
  type OwnerNotification,
} from './notifications-contract';

export async function listOwnerNotifications(
  userId: string,
  tenantId: string,
): Promise<OwnerNotification[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NOTIFICATION_RETENTION_DAYS);
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
        or(eq(notifications.userId, userId), isNull(notifications.userId)),
        or(eq(notifications.tenantId, tenantId), isNull(notifications.tenantId)),
        or(eq(notifications.userId, userId), eq(notifications.tenantId, tenantId)),
        or(isNull(notifications.expiresAt), gt(notifications.expiresAt, new Date())),
        gt(notifications.createdAt, cutoff),
      ),
    )
    .orderBy(desc(notifications.isRead), desc(notifications.createdAt))
    .limit(NOTIFICATION_PAGE_SIZE);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
