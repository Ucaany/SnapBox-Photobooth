import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { booths, boothFrames, frameVersions, frames, getDatabase } from '@snapbox/db';

import { checkEntitlement } from '@/lib/entitlement/entitlement-service';
import { frameIdSchema, type OwnerFrame, type OwnerFramesData } from './frame-contract';
import { signedFrameUrl } from './frame-storage';

export async function listOwnerFrames(tenantId: string): Promise<OwnerFramesData> {
  const db = getDatabase();
  const [rows, boothRows, [usage], entitlement] = await Promise.all([
    db
      .select({
        id: frames.id,
        name: frames.name,
        storageUrl: frames.storageUrl,
        thumbnailUrl: frames.thumbnailUrl,
        width: frames.width,
        height: frames.height,
        fileSizeBytes: frames.fileSizeBytes,
        transparentColorHex: frames.transparentColorHex,
        toleranceDelta: frames.toleranceDelta,
        isActive: frames.isActive,
        createdAt: frames.createdAt,
      })
      .from(frames)
      .where(and(eq(frames.tenantId, tenantId), eq(frames.isDeleted, false)))
      .orderBy(desc(frames.createdAt)),
    db
      .select({ id: booths.id, name: booths.name })
      .from(booths)
      .where(eq(booths.tenantId, tenantId))
      .orderBy(asc(booths.name)),
    db
      .select({ value: count(frames.id) })
      .from(frames)
      .where(and(eq(frames.tenantId, tenantId), eq(frames.isDeleted, false))),
    checkEntitlement(tenantId, 'maxFrameUpload'),
  ]);
  const ids = rows.map((row) => row.id);
  const assignments = ids.length
    ? await db
        .select({
          frameId: boothFrames.frameId,
          boothId: boothFrames.boothId,
          boothName: booths.name,
        })
        .from(boothFrames)
        .innerJoin(booths, and(eq(booths.id, boothFrames.boothId), eq(booths.tenantId, tenantId)))
        .where(inArray(boothFrames.frameId, ids))
    : [];
  const assignmentsByFrame = new Map<string, typeof assignments>();
  for (const assignment of assignments)
    assignmentsByFrame.set(assignment.frameId, [
      ...(assignmentsByFrame.get(assignment.frameId) ?? []),
      assignment,
    ]);
  const data: OwnerFrame[] = await Promise.all(
    rows.map(async (row) => {
      const linked = assignmentsByFrame.get(row.id) ?? [];
      return {
        id: row.id,
        name: row.name,
        previewUrl: row.thumbnailUrl
          ? await signedFrameUrl(row.thumbnailUrl)
          : await signedFrameUrl(row.storageUrl),
        width: row.width,
        height: row.height,
        fileSizeBytes: row.fileSizeBytes,
        transparentColorHex: row.transparentColorHex,
        toleranceDelta: row.toleranceDelta,
        isActive: row.isActive,
        boothIds: linked.map((item) => item.boothId),
        boothNames: linked.map((item) => item.boothName),
        createdAt: row.createdAt.toISOString(),
      };
    }),
  );
  return {
    frames: data,
    booths: boothRows,
    quota: {
      used: Number(usage?.value ?? 0),
      limit:
        entitlement.allowed && typeof entitlement.value === 'number' ? entitlement.value : null,
    },
  };
}

export async function getOwnerFrameForMutation(tenantId: string, id: string) {
  if (!frameIdSchema.safeParse(id).success) return null;
  const [row] = await getDatabase()
    .select({
      id: frames.id,
      name: frames.name,
      storageUrl: frames.storageUrl,
      thumbnailUrl: frames.thumbnailUrl,
      transparentColorHex: frames.transparentColorHex,
      toleranceDelta: frames.toleranceDelta,
      isActive: frames.isActive,
    })
    .from(frames)
    .where(and(eq(frames.id, id), eq(frames.tenantId, tenantId), eq(frames.isDeleted, false)))
    .limit(1);
  return row ?? null;
}

export async function retainFrameVersions(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0],
  frameId: string,
) {
  const versions = await tx
    .select({ id: frameVersions.id })
    .from(frameVersions)
    .where(eq(frameVersions.frameId, frameId))
    .orderBy(desc(frameVersions.versionNumber));
  const stale = versions.slice(5).map((version) => version.id);
  if (stale.length)
    await tx
      .delete(frameVersions)
      .where(and(eq(frameVersions.frameId, frameId), inArray(frameVersions.id, stale)));
}

export const countActiveBoothFrames = async (
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0],
  tenantId: string,
  boothId: string,
  exceptFrameId?: string,
) => {
  const [result] = await tx
    .select({ value: sql<number>`count(*)::int` })
    .from(boothFrames)
    .innerJoin(
      frames,
      and(
        eq(frames.id, boothFrames.frameId),
        eq(frames.tenantId, tenantId),
        eq(frames.isActive, true),
        eq(frames.isDeleted, false),
      ),
    )
    .where(
      and(
        eq(boothFrames.boothId, boothId),
        exceptFrameId ? sql`${boothFrames.frameId} <> ${exceptFrameId}` : sql`true`,
      ),
    );
  return Number(result?.value ?? 0);
};
