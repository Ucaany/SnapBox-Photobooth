/**
 * Server-only broadcast loader, mutation, and delivery adapter.
 *
 * Modul ini TIDAK memakai directive `'use server'`: ia dipanggil dari server
 * component (loader) maupun dari server action (`broadcast/actions.ts`). Yang
 * menjadi server action hanyalah file `actions.ts`; memisahkannya mencegah
 * loader DB terbundel ke klien dan menjaga file `'use server'` hanya mengekspor
 * async function.
 *
 * ponytail: tidak memakai paket `server-only` (belum terpasang) supaya tidak
 * menambah dependency demi satu assertion build-time. Batas nyatanya adalah
 * pemisahan file action; tambahkan `server-only` bila nanti paket itu sudah ada.
 */
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { broadcasts, getDatabase, notifications, tenants, users } from '@snapbox/db';
import { REALTIME_CHANNELS } from '@snapbox/shared/events';

import {
  broadcastInputSchema,
  type BroadcastActionResult,
  type BroadcastHistoryRow,
  type BroadcastInput,
  type BroadcastTenantOption,
} from './broadcast-contract';
import {
  getAuditRequestContext,
  requireCeo,
  TenantServerError,
  writeAuditLogTx,
} from './tenant-server';

export type { BroadcastHistoryRow, BroadcastTenantOption };

const ACTIVE_TENANT = eq(tenants.status, 'ACTIVE');
const NOTIFICATION_TYPE = 'BROADCAST' as const;

export async function listBroadcastTenants(): Promise<readonly BroadcastTenantOption[]> {
  await requireCeo();
  const db = getDatabase();
  const rows = await db
    .select({
      id: tenants.id,
      companyName: tenants.companyName,
      status: tenants.status,
      planTier: tenants.planTier,
      recipientCount: count(users.id),
    })
    .from(tenants)
    .leftJoin(
      users,
      and(
        eq(users.tenantId, tenants.id),
        inArray(users.role, ['OWNER', 'STAFF']),
        eq(users.disabled, false),
        isNull(users.deletedAt),
      ),
    )
    .where(and(ACTIVE_TENANT, isNull(tenants.deletedAt)))
    .groupBy(tenants.id)
    .orderBy(tenants.companyName);

  return rows.map((row) => ({ ...row, recipientCount: Number(row.recipientCount) }));
}

export async function listBroadcastHistory(limit = 25): Promise<readonly BroadcastHistoryRow[]> {
  await requireCeo();
  const rows = await getDatabase()
    .select({
      id: broadcasts.id,
      title: broadcasts.title,
      message: broadcasts.message,
      targetAll: broadcasts.targetAll,
      targetTenantIds: broadcasts.targetTenantIds,
      createdAt: broadcasts.createdAt,
      recipientCount: sql<number>`count(${notifications.id})`,
    })
    .from(broadcasts)
    .leftJoin(
      notifications,
      sql`${notifications.metadata}->>'broadcastId' = ${broadcasts.id}::text`,
    )
    .groupBy(broadcasts.id)
    .orderBy(desc(broadcasts.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    targetAll: row.targetAll,
    targetCount: row.targetAll ? 0 : (row.targetTenantIds?.length ?? 0),
    recipientCount: Number(row.recipientCount),
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Mengirim event broadcast ke channel tenant lewat Realtime Broadcast HTTP.
 *
 * Publish server-only: memakai `SUPABASE_SERVICE_ROLE_KEY` yang tidak pernah
 * masuk bundel klien. Nama channel diambil dari `REALTIME_CHANNELS` supaya
 * tidak ada string channel yang ditulis ulang, dan URL wajib HTTPS.
 *
 * ponytail: event di sini memakai bentuk payload sendiri (`event_id`,
 * `version`, dst) alih-alih `realtimeEventSchema` penuh. Saat Fase 6
 * menyeragamkan amplop realtime, ganti ke schema itu tanpa mengubah pemanggil.
 */
async function publishBroadcast(
  broadcastId: string,
  title: string,
  message: string,
  tenantIds: readonly string[],
): Promise<boolean> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('Realtime belum dikonfigurasi.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !url.startsWith('https://')) throw new Error('Realtime belum dikonfigurasi.');

  const eventId = `${broadcastId}:v1`;
  const base = url.replace(/\/$/, '');
  const response = await fetch(`${base}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: tenantIds.map((tenantId) => ({
        topic: REALTIME_CHANNELS.tenant(tenantId),
        event: 'broadcast.created',
        payload: {
          event_id: eventId,
          version: 1,
          broadcast_id: broadcastId,
          tenant_id: tenantId,
          title,
          message,
        },
        private: true,
      })),
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Realtime publish failed (${response.status}).`);
  return true;
}

function actionFailure(
  code: Extract<BroadcastActionResult, { ok: false }>['code'],
  message: string,
  fieldErrors?: Record<string, string>,
): BroadcastActionResult {
  return { ok: false, code, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

export async function createBroadcast(input: unknown): Promise<BroadcastActionResult> {
  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    return error instanceof TenantServerError
      ? actionFailure('UNAUTHORIZED', error.message)
      : actionFailure('UNAUTHORIZED', 'Aksi tidak dapat diproses.');
  }

  const parsed = broadcastInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[issue.path.join('.') || 'form'] ??= issue.message;
    return actionFailure('INVALID_INPUT', 'Periksa kembali data broadcast.', fieldErrors);
  }
  const data: BroadcastInput = parsed.data;
  const db = getDatabase();
  const auditContext = await getAuditRequestContext();
  let broadcastId = '';
  let targetTenantIds: string[] = [];
  let recipientCount = 0;

  try {
    await db.transaction(async (tx) => {
      const targetRows = data.targetAll
        ? await tx
            .select({ id: tenants.id })
            .from(tenants)
            .where(and(ACTIVE_TENANT, isNull(tenants.deletedAt)))
        : await tx
            .select({ id: tenants.id })
            .from(tenants)
            .where(
              and(inArray(tenants.id, data.tenantIds), ACTIVE_TENANT, isNull(tenants.deletedAt)),
            );
      targetTenantIds = targetRows.map((row) => row.id);
      if (!data.targetAll && targetTenantIds.length !== data.tenantIds.length)
        throw new TenantServerError('NOT_FOUND', 'Satu atau beberapa tenant tidak tersedia.');

      const recipients =
        targetTenantIds.length === 0
          ? []
          : await tx
              .select({ id: users.id, tenantId: users.tenantId })
              .from(users)
              .where(
                and(
                  inArray(users.tenantId, targetTenantIds),
                  inArray(users.role, ['OWNER', 'STAFF']),
                  eq(users.disabled, false),
                  isNull(users.deletedAt),
                ),
              );
      recipientCount = recipients.length;
      const [row] = await tx
        .insert(broadcasts)
        .values({
          actorUserId: session.userId,
          title: data.title,
          message: data.message,
          targetTenantIds: data.targetAll ? null : targetTenantIds,
          targetAll: data.targetAll,
        })
        .returning({ id: broadcasts.id });
      if (!row) throw new Error('Broadcast insert failed.');
      broadcastId = row.id;
      if (recipients.length)
        await tx
          .insert(notifications)
          .values(
            recipients.map((recipient) => ({
              userId: recipient.id,
              tenantId: recipient.tenantId,
              type: NOTIFICATION_TYPE,
              title: data.title,
              message: data.message,
              metadata: { broadcastId, version: 1 },
            })),
          );
      await writeAuditLogTx(
        tx,
        {
          actorUserId: session.userId,
          actorEmail: session.email,
          actorRole: 'CEO',
          tenantId: null,
          action: 'broadcast.create',
          resourceType: 'broadcast',
          resourceId: broadcastId,
          metadata: {
            targetAll: data.targetAll,
            targetCount: targetTenantIds.length,
            recipientCount,
          },
        },
        auditContext,
      );
    });
  } catch (error) {
    if (error instanceof TenantServerError) return actionFailure('INVALID_TARGET', error.message);
    return actionFailure('SERVER_ERROR', 'Broadcast tidak tersimpan.');
  }

  try {
    await publishBroadcast(broadcastId, data.title, data.message, targetTenantIds);
  } catch {
    revalidatePath('/ceo-dashboard/broadcast');
    return actionFailure('DELIVERY_ERROR', 'Broadcast tersimpan, tetapi realtime gagal dikirim.');
  }
  revalidatePath('/ceo-dashboard/broadcast');
  return {
    ok: true,
    broadcastId,
    targetTenantCount: targetTenantIds.length,
    recipientCount,
    message: 'Broadcast berhasil dikirim.',
  };
}
