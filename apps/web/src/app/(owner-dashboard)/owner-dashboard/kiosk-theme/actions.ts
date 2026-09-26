'use server';

import { revalidatePath } from 'next/cache';

import { getDatabase } from '@snapbox/db';
import { REALTIME_CHANNELS, type RealtimeEvent } from '@snapbox/shared/events';

import { getAuditRequestContext, writeAuditLogTx } from '@/lib/ceo-dashboard/tenant-server';
import { publishRealtimeEvent } from '@/lib/ceo-dashboard/realtime-server';
import {
  kioskThemeActionFail,
  kioskThemeContrastErrors,
  kioskThemeDraftSchema,
  kioskThemeFieldErrors,
  themeIdSchema,
  type KioskThemeActionResult,
  type KioskThemeDraft,
} from '@/lib/owner-dashboard/kiosk-theme-contract';
import {
  getOwnerKioskThemeVersion,
  getOrCreateOwnerKioskTheme,
  publishOwnerKioskTheme,
  saveOwnerKioskTheme,
} from '@/lib/owner-dashboard/kiosk-theme-server';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';

const route = '/owner-dashboard/kiosk-theme';
const fail = kioskThemeActionFail;

function parseDraft(
  input: unknown,
): { draft: KioskThemeDraft } | { error: KioskThemeActionResult } {
  const parsed = kioskThemeDraftSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: fail(
        'INVALID_INPUT',
        'Periksa kembali data tema.',
        kioskThemeFieldErrors(parsed.error),
      ),
    };
  const contrastErrors = kioskThemeContrastErrors(parsed.data);
  if (Object.keys(contrastErrors).length)
    return { error: fail('INVALID_INPUT', 'Kontras warna belum memenuhi 4,5:1.', contrastErrors) };
  return { draft: parsed.data };
}

export async function saveKioskTheme(input: unknown): Promise<KioskThemeActionResult> {
  const parsed = parseDraft(input);
  if ('error' in parsed) return parsed.error;
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  try {
    await getOrCreateOwnerKioskTheme(auth.tenantId);
    const context = await getAuditRequestContext();
    const record = await getDatabase().transaction(async (tx) => {
      const saved = await saveOwnerKioskTheme(auth.tenantId, parsed.draft);
      if (!saved) return null;
      await writeAuditLogTx(
        tx,
        {
          actorUserId: auth.session.userId,
          actorEmail: auth.session.email,
          actorRole: 'OWNER',
          tenantId: auth.tenantId,
          action: 'kiosk_theme.save',
          resourceType: 'kiosk_theme',
          resourceId: saved.id,
          metadata: { panelStyle: saved.panelStyle, orientation: saved.orientation },
        },
        context,
      );
      return saved;
    });
    if (!record) return fail('NOT_FOUND', 'Tema kiosk tidak ditemukan.');
    revalidatePath(route);
    return { ok: true, message: 'Draft tema disimpan.' };
  } catch {
    return fail('SERVER_ERROR', 'Draft tema gagal disimpan.');
  }
}

export async function publishKioskTheme(input: unknown): Promise<KioskThemeActionResult> {
  const parsed = parseDraft(input);
  if ('error' in parsed) return parsed.error;
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  let published: Awaited<ReturnType<typeof publishOwnerKioskTheme>>;
  try {
    await getOrCreateOwnerKioskTheme(auth.tenantId);
    published = await publishOwnerKioskTheme(auth.tenantId, parsed.draft);
  } catch {
    return fail('SERVER_ERROR', 'Tema gagal dipublikasikan.');
  }
  if (!published) return fail('NOT_FOUND', 'Tema kiosk tidak ditemukan.');

  const context = await getAuditRequestContext();
  await getDatabase()
    .transaction(async (tx) => {
      await writeAuditLogTx(
        tx,
        {
          actorUserId: auth.session.userId,
          actorEmail: auth.session.email,
          actorRole: 'OWNER',
          tenantId: auth.tenantId,
          action: 'kiosk_theme.publish',
          resourceType: 'kiosk_theme',
          resourceId: published.theme.id,
          metadata: { version: published.version },
        },
        context,
      );
    })
    .catch(() => undefined);
  // Event dikirim SETELAH commit: tema sudah tersimpan, jadi kegagalan Realtime
  // dilaporkan terpisah dan bisa di-publish ulang tanpa mengklaim data hilang.
  const now = new Date().toISOString();
  const event: RealtimeEvent = {
    eventId: `${published.theme.id}:${published.version}`,
    name: 'THEME_UPDATED',
    version: published.version,
    timestamp: now,
    tenantId: auth.tenantId,
    boothId: null,
    deviceId: null,
    payload: {
      themeId: published.theme.id,
      themeVersion: published.version,
      isPublished: true,
      updatedAt: published.theme.updatedAt,
    },
  };
  let eventFailed = false;
  try {
    await publishRealtimeEvent({ channel: REALTIME_CHANNELS.tenant(auth.tenantId), event });
  } catch {
    eventFailed = true;
  }
  revalidatePath(route);
  if (eventFailed)
    return fail(
      'EVENT_FAILED',
      `Tema versi ${published.version} tersimpan dan dipublikasikan, tetapi notifikasi realtime gagal. Publikasikan ulang untuk mengirim THEME_UPDATED.`,
    );
  return { ok: true, message: `Tema versi ${published.version} dipublikasikan.` };
}

export async function restoreKioskThemeVersion(
  versionId: unknown,
): Promise<KioskThemeActionResult & { draft?: KioskThemeDraft }> {
  const parsed = themeIdSchema.safeParse(versionId);
  if (!parsed.success) return fail('INVALID_INPUT', 'ID versi tidak valid.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  try {
    const snapshot = await getOwnerKioskThemeVersion(auth.tenantId, parsed.data);
    if (!snapshot) return fail('NOT_FOUND', 'Versi tema tidak ditemukan.');
    return {
      ok: true,
      message: 'Versi dimuat ke draft. Periksa lalu simpan atau publikasikan.',
      draft: snapshot,
    };
  } catch {
    return fail('SERVER_ERROR', 'Versi tema gagal dimuat.');
  }
}
