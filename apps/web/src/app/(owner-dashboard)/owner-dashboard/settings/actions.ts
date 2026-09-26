'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDatabase, users } from '@snapbox/db';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';
import { ownerProfileSchema } from '@/lib/owner-dashboard/account-contract';

export async function updateOwnerProfile(input: unknown): Promise<boolean> {
  const parsed = ownerProfileSchema.safeParse(input);
  if (!parsed.success) return false;
  const auth = await requireOwnerTenant();
  if (!auth) return false;
  const [updated] = await getDatabase()
    .update(users)
    .set({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, auth.session.userId))
    .returning({ id: users.id });
  if (!updated) return false;
  revalidatePath('/owner-dashboard/settings');
  return true;
}

export async function getOwnerSettings(userId: string) {
  const auth = await requireOwnerTenant();
  if (!auth || auth.session.userId !== userId) return null;
  const [profile] = await getDatabase()
    .select({ fullName: users.fullName, email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return profile ?? null;
}
