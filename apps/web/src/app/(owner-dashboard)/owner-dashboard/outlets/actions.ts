'use server';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { getDatabase, outlets } from '@snapbox/db';
import { checkEntitlement } from '@/lib/entitlement/entitlement-service';
import {
  fieldErrors,
  outletInputSchema,
  outletUpdateSchema,
  type OutletActionResult,
} from '@/lib/owner-dashboard/outlet-contract';
import { outletQuota, requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';

const fail = (
  code: Extract<OutletActionResult, { ok: false }>['code'],
  message: string,
  fields?: Record<string, string>,
): OutletActionResult => ({ ok: false, code, message, ...(fields ? { fieldErrors: fields } : {}) });
export async function createOutlet(input: unknown): Promise<OutletActionResult> {
  const parsed = outletInputSchema.safeParse(input);
  if (!parsed.success)
    return fail('INVALID_INPUT', 'Periksa kembali nilai yang diisi.', fieldErrors(parsed.error));
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  const entitlement = await checkEntitlement(auth.tenantId, 'outletLimit');
  if (
    !entitlement.allowed ||
    (entitlement.value !== -1 &&
      (typeof entitlement.value !== 'number' ||
        (await outletQuota(auth.tenantId)).used >= entitlement.value))
  )
    return fail('LIMIT_REACHED', 'Batas outlet plan telah tercapai.');
  try {
    const [created] = await getDatabase()
      .insert(outlets)
      .values({ ...parsed.data, tenantId: auth.tenantId })
      .returning({ id: outlets.id });
    if (!created) return fail('SERVER_ERROR', 'Outlet gagal dibuat.');
    revalidatePath('/owner-dashboard/outlets');
    return { ok: true, outletId: created.id, message: 'Outlet dibuat.' };
  } catch {
    return fail('SERVER_ERROR', 'Outlet gagal dibuat.');
  }
}
export async function updateOutlet(input: unknown): Promise<OutletActionResult> {
  const parsed = outletUpdateSchema.safeParse(input);
  if (!parsed.success)
    return fail('INVALID_INPUT', 'Periksa kembali nilai yang diisi.', fieldErrors(parsed.error));
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  const { id, ...data } = parsed.data;
  try {
    const [updated] = await getDatabase()
      .update(outlets)
      .set(data)
      .where(and(eq(outlets.id, id), eq(outlets.tenantId, auth.tenantId)))
      .returning({ id: outlets.id });
    if (!updated) return fail('NOT_FOUND', 'Outlet tidak ditemukan.');
    revalidatePath('/owner-dashboard/outlets');
    revalidatePath(`/owner-dashboard/outlets/${id}`);
    return { ok: true, outletId: id, message: 'Outlet diperbarui.' };
  } catch {
    return fail('SERVER_ERROR', 'Outlet gagal diperbarui.');
  }
}
export async function setOutletActive(id: unknown, isActive: unknown): Promise<OutletActionResult> {
  const parsedId = outletUpdateSchema.shape.id.safeParse(id);
  if (!parsedId.success || typeof isActive !== 'boolean')
    return fail('INVALID_INPUT', 'Data outlet tidak valid.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  try {
    const [updated] = await getDatabase()
      .update(outlets)
      .set({ isActive })
      .where(and(eq(outlets.id, parsedId.data), eq(outlets.tenantId, auth.tenantId)))
      .returning({ id: outlets.id });
    if (!updated) return fail('NOT_FOUND', 'Outlet tidak ditemukan.');
    revalidatePath('/owner-dashboard/outlets');
    revalidatePath(`/owner-dashboard/outlets/${parsedId.data}`);
    return {
      ok: true,
      outletId: parsedId.data,
      message: isActive ? 'Outlet diaktifkan.' : 'Outlet dinonaktifkan.',
    };
  } catch {
    return fail('SERVER_ERROR', 'Status outlet gagal diubah.');
  }
}
