'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { buildCustomClaims } from '@snapbox/auth';
import {
  createUserWithoutPassword,
  deleteUser,
  findUserByEmail,
  generatePasswordResetLink,
  setUserClaims,
  setUserDisabled,
} from '@snapbox/auth/admin';
import { getDatabase, users } from '@snapbox/db';
import { sendStaffInviteEmail } from '@/lib/email/resend';
import { checkEntitlement } from '@/lib/entitlement/entitlement-service';
import { getAuditRequestContext, writeAuditLogTx } from '@/lib/ceo-dashboard/tenant-server';
import {
  fieldErrors,
  staffCreateSchema,
  staffIdSchema,
  staffStatusSchema,
  staffUpdateSchema,
  type StaffActionResult,
} from '@/lib/owner-dashboard/staff-contract';
import {
  requireOwnerTenant,
  staffQuota,
  ownerCompanyName,
} from '@/lib/owner-dashboard/staff-server';

const fail = (
  code: Extract<StaffActionResult, { ok: false }>['code'],
  message: string,
  fields?: Record<string, string>,
): StaffActionResult => ({ ok: false, code, message, ...(fields ? { fieldErrors: fields } : {}) });
const scope = (id: string, tenantId: string) =>
  and(
    eq(users.id, id),
    eq(users.role, 'STAFF'),
    eq(users.tenantId, tenantId),
    eq(users.parentTenantId, tenantId),
  );

export async function createStaff(input: unknown): Promise<StaffActionResult> {
  const parsed = staffCreateSchema.safeParse(input);
  if (!parsed.success)
    return fail('INVALID_INPUT', 'Periksa nama dan email staff.', fieldErrors(parsed.error));
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  const entitlement = await checkEntitlement(auth.tenantId, 'staffLimit');
  if (!entitlement.allowed) return fail('LIMIT_REACHED', 'Kuota staff tidak tersedia.');
  const staffLimit = typeof entitlement.value === 'number' ? entitlement.value : null;
  if (staffLimit === null) return fail('LIMIT_REACHED', 'Kuota staff tidak tersedia.');
  if (staffLimit !== -1 && (await staffQuota(auth.tenantId)).used >= staffLimit)
    return fail('LIMIT_REACHED', 'Batas staff plan telah tercapai.');
  const { email, fullName } = parsed.data;
  const db = getDatabase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing || (await findUserByEmail(email)))
    return fail('DUPLICATE_EMAIL', 'Email sudah digunakan.');
  let firebaseUid: string | null = null;
  try {
    const firebaseUser = await createUserWithoutPassword(email);
    firebaseUid = firebaseUser.uid;
    await setUserClaims(
      firebaseUid,
      buildCustomClaims({
        appRole: 'STAFF',
        tenantId: auth.tenantId,
        parentTenantId: auth.tenantId,
      }),
    );
    const result = await db.transaction(async (tx) => {
      const current = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.role, 'STAFF'),
            eq(users.tenantId, auth.tenantId),
            eq(users.parentTenantId, auth.tenantId),
            eq(users.disabled, false),
          ),
        )
        .then((rows) => rows.length);
      if (staffLimit !== -1 && current >= staffLimit) throw new Error('STAFF_QUOTA');
      if (!firebaseUid) throw new Error('FIREBASE_FAILED');
      const [created] = await tx
        .insert(users)
        .values({
          firebaseUid,
          email,
          fullName,
          role: 'STAFF',
          tenantId: auth.tenantId,
          parentTenantId: auth.tenantId,
          disabled: false,
        })
        .returning({ id: users.id });
      if (!created) throw new Error('INSERT_FAILED');
      await writeAuditLogTx(
        tx,
        {
          actorUserId: auth.session.userId,
          actorEmail: auth.session.email,
          actorRole: 'OWNER',
          tenantId: auth.tenantId,
          action: 'staff.create',
          resourceType: 'user',
          resourceId: created.id,
          metadata: { email },
        },
        await getAuditRequestContext(),
      );
      return created.id;
    });
    const inviteUrl = await generatePasswordResetLink(email);
    const delivery = await sendStaffInviteEmail({
      to: email,
      staffName: fullName,
      companyName: await ownerCompanyName(auth.tenantId),
      inviteUrl,
    });
    revalidatePath('/owner-dashboard/staff');
    return {
      ok: true,
      staffId: result,
      emailDelivered: delivery.ok,
      message: delivery.ok
        ? 'Staff dibuat dan undangan terkirim.'
        : `Staff dibuat, tetapi undangan gagal dikirim. ${delivery.message}`,
    };
  } catch (error) {
    if (firebaseUid) await deleteUser(firebaseUid).catch(() => undefined);
    return fail(
      error instanceof Error && error.message === 'STAFF_QUOTA' ? 'LIMIT_REACHED' : 'SERVER_ERROR',
      error instanceof Error && error.message === 'STAFF_QUOTA'
        ? 'Batas staff plan telah tercapai.'
        : 'Staff gagal dibuat.',
    );
  }
}

export async function updateStaff(input: unknown): Promise<StaffActionResult> {
  const parsed = staffUpdateSchema.safeParse(input);
  if (!parsed.success)
    return fail('INVALID_INPUT', 'Nama staff tidak valid.', fieldErrors(parsed.error));
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  try {
    const [updated] = await getDatabase()
      .update(users)
      .set({ fullName: parsed.data.fullName, updatedAt: new Date() })
      .where(scope(parsed.data.id, auth.tenantId))
      .returning({ id: users.id });
    if (!updated) return fail('NOT_FOUND', 'Staff tidak ditemukan.');
    await writeAuditLogTx(
      getDatabase(),
      {
        actorUserId: auth.session.userId,
        actorEmail: auth.session.email,
        actorRole: 'OWNER',
        tenantId: auth.tenantId,
        action: 'staff.update',
        resourceType: 'user',
        resourceId: parsed.data.id,
      },
      await getAuditRequestContext(),
    );
    revalidatePath('/owner-dashboard/staff');
    return { ok: true, staffId: parsed.data.id, message: 'Nama staff diperbarui.' };
  } catch {
    return fail('SERVER_ERROR', 'Staff gagal diperbarui.');
  }
}

export async function setStaffActive(input: unknown): Promise<StaffActionResult> {
  const parsed = staffStatusSchema.safeParse(input);
  if (!parsed.success) return fail('INVALID_INPUT', 'Status staff tidak valid.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  const [target] = await getDatabase()
    .select({ id: users.id, firebaseUid: users.firebaseUid })
    .from(users)
    .where(scope(parsed.data.id, auth.tenantId))
    .limit(1);
  if (!target) return fail('NOT_FOUND', 'Staff tidak ditemukan.');
  try {
    await setUserDisabled(target.firebaseUid, !parsed.data.isActive);
    try {
      await getDatabase()
        .update(users)
        .set({ disabled: !parsed.data.isActive, updatedAt: new Date() })
        .where(scope(parsed.data.id, auth.tenantId));
    } catch {
      await setUserDisabled(target.firebaseUid, parsed.data.isActive).catch(() => undefined);
      throw new Error('DB');
    }
    await writeAuditLogTx(
      getDatabase(),
      {
        actorUserId: auth.session.userId,
        actorEmail: auth.session.email,
        actorRole: 'OWNER',
        tenantId: auth.tenantId,
        action: parsed.data.isActive ? 'staff.reactivate' : 'staff.deactivate',
        resourceType: 'user',
        resourceId: parsed.data.id,
      },
      await getAuditRequestContext(),
    );
    revalidatePath('/owner-dashboard/staff');
    return {
      ok: true,
      staffId: parsed.data.id,
      message: parsed.data.isActive ? 'Staff diaktifkan.' : 'Staff dinonaktifkan.',
    };
  } catch {
    return fail('SERVER_ERROR', 'Status staff gagal diubah.');
  }
}

export async function resendStaffInvite(input: unknown): Promise<StaffActionResult> {
  const parsed = staffIdSchema.safeParse(input);
  if (!parsed.success) return fail('INVALID_INPUT', 'Staff tidak valid.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  const [target] = await getDatabase()
    .select({ email: users.email, fullName: users.fullName })
    .from(users)
    .where(and(scope(parsed.data, auth.tenantId), eq(users.disabled, false)))
    .limit(1);
  if (!target) return fail('NOT_FOUND', 'Staff aktif tidak ditemukan.');
  try {
    const inviteUrl = await generatePasswordResetLink(target.email);
    const delivery = await sendStaffInviteEmail({
      to: target.email,
      staffName: target.fullName,
      companyName: await ownerCompanyName(auth.tenantId),
      inviteUrl,
    });
    if (!delivery.ok) return fail('INVITE_FAILED', delivery.message);
    return {
      ok: true,
      staffId: parsed.data,
      emailDelivered: true,
      message: 'Undangan dikirim ulang.',
    };
  } catch {
    return fail('INVITE_FAILED', 'Undangan gagal dibuat.');
  }
}
