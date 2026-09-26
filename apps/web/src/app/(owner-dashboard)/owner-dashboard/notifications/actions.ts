'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, or, isNull } from 'drizzle-orm';
import { getDatabase, notifications } from '@snapbox/db';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';
import { notificationIdSchema } from '@/lib/owner-dashboard/notifications-contract';

export async function markOwnerNotificationRead(input: unknown): Promise<boolean> {
  const parsed = notificationIdSchema.safeParse(input);
  if (!parsed.success) return false;
  const auth = await requireOwnerTenant();
  if (!auth) return false;
  const [updated] = await getDatabase()
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.id, parsed.data),
        eq(notifications.isRead, false),
        or(eq(notifications.userId, auth.session.userId), isNull(notifications.userId)),
        or(eq(notifications.tenantId, auth.tenantId), isNull(notifications.tenantId)),
        or(
          eq(notifications.userId, auth.session.userId),
          eq(notifications.tenantId, auth.tenantId),
        ),
      ),
    )
    .returning({ id: notifications.id });
  if (!updated) {
    const [existing] = await getDatabase()
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.id, parsed.data),
          eq(notifications.isRead, true),
          or(eq(notifications.userId, auth.session.userId), isNull(notifications.userId)),
          or(eq(notifications.tenantId, auth.tenantId), isNull(notifications.tenantId)),
          or(
            eq(notifications.userId, auth.session.userId),
            eq(notifications.tenantId, auth.tenantId),
          ),
        ),
      )
      .limit(1);
    return Boolean(existing);
  }
  revalidatePath('/owner-dashboard/notifications');
  return true;
}
