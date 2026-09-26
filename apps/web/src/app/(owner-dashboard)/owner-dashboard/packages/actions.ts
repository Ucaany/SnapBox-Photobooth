'use server';

import { and, eq } from 'drizzle-orm';
import { getDatabase, booths, packages } from '@snapbox/db';
import { revalidatePath } from 'next/cache';
import {
  packageActionFail,
  packageIdSchema,
  packageInputSchema,
  packageUpdateSchema,
  type PackageActionResult,
} from '@/lib/owner-dashboard/package-contract';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';

const fail = packageActionFail;
function refresh() {
  revalidatePath('/owner-dashboard/packages');
  revalidatePath('/owner-dashboard/machines');
}

async function validBooth(boothId: string | null, tenantId: string) {
  if (!boothId) return true;
  const [booth] = await getDatabase()
    .select({ id: booths.id })
    .from(booths)
    .where(and(eq(booths.id, boothId), eq(booths.tenantId, tenantId)))
    .limit(1);
  return Boolean(booth);
}

export async function createPackage(input: unknown): Promise<PackageActionResult> {
  const parsed = packageInputSchema.safeParse(input);
  if (!parsed.success) return fail('INVALID_INPUT', 'Periksa kembali nilai paket.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  try {
    if (!(await validBooth(parsed.data.boothId, auth.tenantId)))
      return fail('INVALID_INPUT', 'Booth tidak valid.');
    const [created] = await getDatabase()
      .insert(packages)
      .values({ ...parsed.data, tenantId: auth.tenantId })
      .returning({ id: packages.id });
    if (!created) return fail('SERVER_ERROR', 'Paket gagal dibuat.');
    refresh();
    return { ok: true, packageId: created.id, message: 'Paket dibuat.' };
  } catch {
    return fail('SERVER_ERROR', 'Paket gagal dibuat.');
  }
}

export async function updatePackage(input: unknown): Promise<PackageActionResult> {
  const parsed = packageUpdateSchema.safeParse(input);
  if (!parsed.success) return fail('INVALID_INPUT', 'Periksa kembali nilai paket.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  const { id, ...data } = parsed.data;
  try {
    if (!(await validBooth(data.boothId, auth.tenantId)))
      return fail('INVALID_INPUT', 'Booth tidak valid.');
    const [updated] = await getDatabase()
      .update(packages)
      .set(data)
      .where(and(eq(packages.id, id), eq(packages.tenantId, auth.tenantId)))
      .returning({ id: packages.id });
    if (!updated) return fail('NOT_FOUND', 'Paket tidak ditemukan.');
    refresh();
    return { ok: true, packageId: id, message: 'Paket diperbarui.' };
  } catch {
    return fail('SERVER_ERROR', 'Paket gagal diperbarui.');
  }
}

export async function deletePackage(id: unknown): Promise<PackageActionResult> {
  const parsed = packageIdSchema.safeParse(id);
  if (!parsed.success) return fail('INVALID_INPUT', 'Paket tidak valid.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  try {
    const [deleted] = await getDatabase()
      .delete(packages)
      .where(and(eq(packages.id, parsed.data), eq(packages.tenantId, auth.tenantId)))
      .returning({ id: packages.id });
    if (!deleted) return fail('NOT_FOUND', 'Paket tidak ditemukan.');
    refresh();
    return { ok: true, packageId: parsed.data, message: 'Paket dihapus.' };
  } catch {
    return fail('CONFLICT', 'Paket tidak dapat dihapus karena sudah digunakan transaksi.');
  }
}

export async function setPackageActive(
  id: unknown,
  isActive: unknown,
): Promise<PackageActionResult> {
  const parsed = packageIdSchema.safeParse(id);
  if (!parsed.success || typeof isActive !== 'boolean')
    return fail('INVALID_INPUT', 'Data paket tidak valid.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  try {
    const [updated] = await getDatabase()
      .update(packages)
      .set({ isActive })
      .where(and(eq(packages.id, parsed.data), eq(packages.tenantId, auth.tenantId)))
      .returning({ id: packages.id });
    if (!updated) return fail('NOT_FOUND', 'Paket tidak ditemukan.');
    refresh();
    return {
      ok: true,
      packageId: parsed.data,
      message: isActive ? 'Paket diaktifkan.' : 'Paket dinonaktifkan.',
    };
  } catch {
    return fail('SERVER_ERROR', 'Status paket gagal diubah.');
  }
}
