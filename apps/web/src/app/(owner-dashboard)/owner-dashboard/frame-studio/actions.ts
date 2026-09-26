'use server';

import { and, count, desc, eq, sql } from 'drizzle-orm';
import { booths, boothFrames, frameVersions, frames, getDatabase } from '@snapbox/db';
import { revalidatePath } from 'next/cache';

import { checkEntitlement } from '@/lib/entitlement/entitlement-service';
import { getAuditRequestContext, writeAuditLogTx } from '@/lib/ceo-dashboard/tenant-server';
import {
  frameActionFail,
  frameBoothIdSchema,
  frameHexSchema,
  frameIdSchema,
  frameQuotaReached,
  frameToleranceSchema,
  type FrameActionResult,
} from '@/lib/owner-dashboard/frame-contract';
import {
  countActiveBoothFrames,
  getOwnerFrameForMutation,
  retainFrameVersions,
} from '@/lib/owner-dashboard/frame-server';
import {
  inspectFrameFile,
  removeFrameObjects,
  uploadFrameObjects,
} from '@/lib/owner-dashboard/frame-storage';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';

const route = '/owner-dashboard/frame-studio';
const fail = frameActionFail;

function readCommon(form: FormData) {
  const name = form.get('name');
  const boothId = form.get('boothId');
  const isActive = form.get('isActive');
  const color = form.get('transparentColorHex');
  const normalizedColor = typeof color === 'string' ? color : null;
  const tolerance = Number(form.get('toleranceDelta'));
  if (
    typeof name !== 'string' ||
    name.trim().length < 1 ||
    name.trim().length > 150 ||
    typeof boothId !== 'string' ||
    !frameBoothIdSchema.safeParse(boothId || null).success ||
    !['true', 'false'].includes(String(isActive)) ||
    (isActive === 'true' && !boothId) ||
    !(
      normalizedColor === '' ||
      (normalizedColor !== null && frameHexSchema.safeParse(normalizedColor).success)
    ) ||
    !frameToleranceSchema.safeParse(tolerance).success
  )
    return null;
  return {
    name: name.trim(),
    boothId: boothId || null,
    isActive: isActive === 'true',
    transparentColorHex: normalizedColor || null,
    toleranceDelta: tolerance,
  };
}

async function assertBooth(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0],
  tenantId: string,
  boothId: string | null,
) {
  if (!boothId) return true;
  const [booth] = await tx
    .select({ id: booths.id })
    .from(booths)
    .where(and(eq(booths.id, boothId), eq(booths.tenantId, tenantId)))
    .limit(1);
  return Boolean(booth);
}

async function lockBooth(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0],
  boothId: string,
) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${boothId}, 0))`);
}

async function createVersion(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0],
  frameId: string,
  values: { storageUrl: string; transparentColorHex: string | null; toleranceDelta: number },
) {
  const [latest] = await tx
    .select({ versionNumber: frameVersions.versionNumber })
    .from(frameVersions)
    .where(eq(frameVersions.frameId, frameId))
    .orderBy(desc(frameVersions.versionNumber))
    .limit(1);
  await tx
    .insert(frameVersions)
    .values({ frameId, ...values, versionNumber: (latest?.versionNumber ?? 0) + 1 });
  await retainFrameVersions(tx, frameId);
}

export async function createFrame(form: FormData): Promise<FrameActionResult> {
  const input = readCommon(form);
  const file = form.get('file');
  if (!input || !(file instanceof File))
    return fail('INVALID_INPUT', 'Data atau file frame tidak valid.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  let inspected: Awaited<ReturnType<typeof inspectFrameFile>>;
  try {
    inspected = await inspectFrameFile(file);
  } catch {
    return fail('INVALID_INPUT', 'Gunakan PNG/JPG maksimum 5 MB dengan dimensi minimal 800 × 600.');
  }
  const entitlement = await checkEntitlement(auth.tenantId, 'maxFrameUpload');
  if (!entitlement.allowed || typeof entitlement.value !== 'number')
    return fail('LIMIT_REACHED', 'Kuota frame tidak tersedia untuk paket ini.');

  const db = getDatabase();
  const id = crypto.randomUUID();
  let paths: { originalPath: string; thumbnailPath: string } | undefined;
  try {
    paths = await uploadFrameObjects(auth.tenantId, id, inspected);
    const context = await getAuditRequestContext();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${auth.tenantId}, 1))`);
      const [usage] = await tx
        .select({ value: count(frames.id) })
        .from(frames)
        .where(and(eq(frames.tenantId, auth.tenantId), eq(frames.isDeleted, false)));
      if (frameQuotaReached(Number(usage?.value ?? 0), Number(entitlement.value)))
        return { error: 'quota' as const };
      if (!(await assertBooth(tx, auth.tenantId, input.boothId)))
        return { error: 'not_found' as const };
      if (input.boothId && input.isActive) {
        await lockBooth(tx, input.boothId);
        if ((await countActiveBoothFrames(tx, auth.tenantId, input.boothId)) >= 8)
          return { error: 'limit' as const };
      }
      const [row] = await tx
        .insert(frames)
        .values({
          id,
          tenantId: auth.tenantId,
          name: input.name,
          storageUrl: paths!.originalPath,
          thumbnailUrl: paths!.thumbnailPath,
          width: inspected.width,
          height: inspected.height,
          fileSizeBytes: inspected.buffer.byteLength,
          transparentColorHex: input.transparentColorHex,
          toleranceDelta: input.toleranceDelta,
          isActive: input.isActive,
        })
        .returning({ id: frames.id });
      if (!row) throw new Error('DB_FAILED');
      if (input.boothId)
        await tx.insert(boothFrames).values({ boothId: input.boothId, frameId: id });
      await createVersion(tx, id, {
        storageUrl: paths!.originalPath,
        transparentColorHex: input.transparentColorHex,
        toleranceDelta: input.toleranceDelta,
      });
      await writeAuditLogTx(
        tx,
        {
          actorUserId: auth.session.userId,
          actorEmail: auth.session.email,
          actorRole: 'OWNER',
          tenantId: auth.tenantId,
          action: 'frame.create',
          resourceType: 'frame',
          resourceId: id,
          metadata: { name: input.name },
        },
        context,
      );
      return { error: null } as const;
    });
    if (result.error) {
      await removeFrameObjects([paths.originalPath, paths.thumbnailPath]);
      if (result.error === 'quota')
        return fail('LIMIT_REACHED', 'Batas jumlah frame paket telah tercapai.');
      return fail(
        result.error === 'limit' ? 'LIMIT_REACHED' : 'NOT_FOUND',
        result.error === 'limit' ? 'Booth sudah memiliki 8 frame aktif.' : 'Booth tidak ditemukan.',
      );
    }
    revalidatePath(route);
    return { ok: true, frameId: id, message: 'Frame berhasil dibuat.' };
  } catch {
    if (paths)
      await removeFrameObjects([paths.originalPath, paths.thumbnailPath]).catch(() => undefined);
    return fail('SERVER_ERROR', 'Frame gagal dibuat.');
  }
}

export async function updateFrame(form: FormData): Promise<FrameActionResult> {
  const id = form.get('id');
  const input = readCommon(form);
  const file = form.get('file');
  if (
    typeof id !== 'string' ||
    !frameIdSchema.safeParse(id).success ||
    !input ||
    (file !== null && !(file instanceof File))
  )
    return fail('INVALID_INPUT', 'Data frame tidak valid.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  const current = await getOwnerFrameForMutation(auth.tenantId, id);
  if (!current) return fail('NOT_FOUND', 'Frame tidak ditemukan.');
  let inspected: Awaited<ReturnType<typeof inspectFrameFile>> | null = null;
  if (file instanceof File && file.size) {
    try {
      inspected = await inspectFrameFile(file);
    } catch {
      return fail(
        'INVALID_INPUT',
        'Gunakan PNG/JPG maksimum 5 MB dengan dimensi minimal 800 × 600.',
      );
    }
  }
  const db = getDatabase();
  let newPaths: { originalPath: string; thumbnailPath: string } | undefined;
  try {
    if (inspected) newPaths = await uploadFrameObjects(auth.tenantId, id, inspected);
    const context = await getAuditRequestContext();
    const result = await db.transaction(async (tx) => {
      if (!(await assertBooth(tx, auth.tenantId, input.boothId)))
        return { error: 'not_found' as const };
      if (input.boothId && input.isActive) {
        await lockBooth(tx, input.boothId);
        if ((await countActiveBoothFrames(tx, auth.tenantId, input.boothId, id)) >= 8)
          return { error: 'limit' as const };
      }
      const [updated] = await tx
        .update(frames)
        .set({
          name: input.name,
          storageUrl: newPaths?.originalPath ?? current.storageUrl,
          thumbnailUrl: newPaths?.thumbnailPath ?? (inspected ? current.thumbnailUrl : undefined),
          width: inspected?.width,
          height: inspected?.height,
          fileSizeBytes: inspected?.buffer.byteLength,
          transparentColorHex: input.transparentColorHex,
          toleranceDelta: input.toleranceDelta,
          isActive: input.isActive,
          updatedAt: new Date(),
        })
        .where(
          and(eq(frames.id, id), eq(frames.tenantId, auth.tenantId), eq(frames.isDeleted, false)),
        )
        .returning({ id: frames.id });
      if (!updated) return { error: 'not_found' as const };
      await tx.delete(boothFrames).where(eq(boothFrames.frameId, id));
      if (input.boothId)
        await tx
          .insert(boothFrames)
          .values({ boothId: input.boothId, frameId: id })
          .onConflictDoNothing();
      await createVersion(tx, String(id), {
        storageUrl: newPaths?.originalPath ?? current.storageUrl,
        transparentColorHex: input.transparentColorHex,
        toleranceDelta: input.toleranceDelta,
      });
      await writeAuditLogTx(
        tx,
        {
          actorUserId: auth.session.userId,
          actorEmail: auth.session.email,
          actorRole: 'OWNER',
          tenantId: auth.tenantId,
          action: 'frame.update',
          resourceType: 'frame',
          resourceId: id,
          metadata: { isActive: input.isActive },
        },
        context,
      );
      return { error: null } as const;
    });
    if (result.error) {
      if (newPaths) await removeFrameObjects([newPaths.originalPath, newPaths.thumbnailPath]);
      return fail(
        result.error === 'limit' ? 'LIMIT_REACHED' : 'NOT_FOUND',
        result.error === 'limit'
          ? 'Booth sudah memiliki 8 frame aktif.'
          : 'Frame atau booth tidak ditemukan.',
      );
    }
    revalidatePath(route);
    return { ok: true, frameId: id, message: 'Frame diperbarui.' };
  } catch {
    if (newPaths)
      await removeFrameObjects([newPaths.originalPath, newPaths.thumbnailPath]).catch(
        () => undefined,
      );
    return fail('SERVER_ERROR', 'Frame gagal diperbarui.');
  }
}

export async function deleteFrame(id: unknown): Promise<FrameActionResult> {
  if (typeof id !== 'string' || !frameIdSchema.safeParse(id).success)
    return fail('NOT_FOUND', 'Frame tidak ditemukan.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  const current = await getOwnerFrameForMutation(auth.tenantId, id);
  if (!current) return fail('NOT_FOUND', 'Frame tidak ditemukan.');
  try {
    const context = await getAuditRequestContext();
    const result = await getDatabase().transaction(async (tx) => {
      const [assignment] = await tx
        .select({ boothId: boothFrames.boothId })
        .from(boothFrames)
        .innerJoin(
          booths,
          and(eq(booths.id, boothFrames.boothId), eq(booths.tenantId, auth.tenantId)),
        )
        .where(eq(boothFrames.frameId, id))
        .limit(1);
      if (current.isActive || assignment) return false;
      await tx
        .update(frames)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(
          and(eq(frames.id, id), eq(frames.tenantId, auth.tenantId), eq(frames.isDeleted, false)),
        );
      await writeAuditLogTx(
        tx,
        {
          actorUserId: auth.session.userId,
          actorEmail: auth.session.email,
          actorRole: 'OWNER',
          tenantId: auth.tenantId,
          action: 'frame.delete',
          resourceType: 'frame',
          resourceId: id,
        },
        context,
      );
      return true;
    });
    if (!result)
      return fail('CONFLICT', 'Nonaktifkan frame dan hapus penugasan booth sebelum menghapus.');
    revalidatePath(route);
    await removeFrameObjects([
      current.storageUrl,
      current.thumbnailUrl ?? `tenant/${auth.tenantId}/frames/${id}.thumb.jpg`,
    ]).catch(() => undefined);
    return { ok: true, frameId: id, message: 'Frame dihapus.' };
  } catch {
    return fail('SERVER_ERROR', 'Frame gagal dihapus.');
  }
}
