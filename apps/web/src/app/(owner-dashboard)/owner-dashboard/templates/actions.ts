'use server';

import { and, eq } from 'drizzle-orm';
import { getDatabase, templates } from '@snapbox/db';
import { revalidatePath } from 'next/cache';

import {
  templateActionFail,
  templateIdSchema,
  templateInputSchema,
  templateUpdateSchema,
  type TemplateActionResult,
} from '@/lib/owner-dashboard/template-contract';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';

const route = '/owner-dashboard/templates';

export async function createTemplate(input: unknown): Promise<TemplateActionResult> {
  const parsed = templateInputSchema.safeParse(input);
  if (!parsed.success) return templateActionFail('INVALID_INPUT', 'Periksa kembali data template.');
  const auth = await requireOwnerTenant();
  if (!auth) return templateActionFail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  try {
    const [created] = await getDatabase()
      .insert(templates)
      .values({ ...parsed.data, tenantId: auth.tenantId })
      .returning({ id: templates.id });
    if (!created) return templateActionFail('SERVER_ERROR', 'Template gagal dibuat.');
    revalidatePath(route);
    return { ok: true, templateId: created.id, message: 'Template dibuat.' };
  } catch {
    return templateActionFail('SERVER_ERROR', 'Template gagal dibuat.');
  }
}

export async function updateTemplate(input: unknown): Promise<TemplateActionResult> {
  const parsed = templateUpdateSchema.safeParse(input);
  if (!parsed.success) return templateActionFail('INVALID_INPUT', 'Periksa kembali data template.');
  const auth = await requireOwnerTenant();
  if (!auth) return templateActionFail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  const { id, ...data } = parsed.data;
  try {
    const [updated] = await getDatabase()
      .update(templates)
      .set(data)
      .where(and(eq(templates.id, id), eq(templates.tenantId, auth.tenantId)))
      .returning({ id: templates.id });
    if (!updated) return templateActionFail('NOT_FOUND', 'Template tidak ditemukan.');
    revalidatePath(route);
    return { ok: true, templateId: id, message: 'Template diperbarui.' };
  } catch {
    return templateActionFail('SERVER_ERROR', 'Template gagal diperbarui.');
  }
}

export async function deleteTemplate(id: unknown): Promise<TemplateActionResult> {
  const parsedId = templateIdSchema.safeParse(id);
  if (!parsedId.success) return templateActionFail('INVALID_INPUT', 'ID template tidak valid.');
  const auth = await requireOwnerTenant();
  if (!auth) return templateActionFail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  try {
    const [deleted] = await getDatabase()
      .delete(templates)
      .where(and(eq(templates.id, parsedId.data), eq(templates.tenantId, auth.tenantId)))
      .returning({ id: templates.id });
    if (!deleted) return templateActionFail('NOT_FOUND', 'Template tidak ditemukan.');
    revalidatePath(route);
    return { ok: true, templateId: deleted.id, message: 'Template dihapus.' };
  } catch {
    return templateActionFail('SERVER_ERROR', 'Template gagal dihapus.');
  }
}

export async function setTemplateActive(
  id: unknown,
  isActive: unknown,
): Promise<TemplateActionResult> {
  const parsedId = templateIdSchema.safeParse(id);
  if (!parsedId.success || typeof isActive !== 'boolean')
    return templateActionFail('INVALID_INPUT', 'Data template tidak valid.');
  const auth = await requireOwnerTenant();
  if (!auth) return templateActionFail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  try {
    const [updated] = await getDatabase()
      .update(templates)
      .set({ isActive })
      .where(and(eq(templates.id, parsedId.data), eq(templates.tenantId, auth.tenantId)))
      .returning({ id: templates.id });
    if (!updated) return templateActionFail('NOT_FOUND', 'Template tidak ditemukan.');
    revalidatePath(route);
    return {
      ok: true,
      templateId: updated.id,
      message: isActive ? 'Template diaktifkan.' : 'Template dinonaktifkan.',
    };
  } catch {
    return templateActionFail('SERVER_ERROR', 'Status template gagal diubah.');
  }
}
