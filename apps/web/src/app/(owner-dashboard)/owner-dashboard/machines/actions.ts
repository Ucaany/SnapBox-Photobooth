'use server';
/**
 * Server Actions Machine Manager (PRD Task 2.3, Bab 6.B/6.K).
 *
 * Kontrak yang mengikat:
 * - Otorisasi diulang ke DB setiap aksi lewat `requireOwnerTenant` (ADR-004).
 * - `tenantId` selalu dari sesi; tidak pernah dari input.
 * - Semua UPDATE/DELETE menyertakan predikat `tenantId` sehingga id lintas
 *   tenant berakhir `NOT_FOUND` yang tidak bisa dibedakan dari id tidak ada.
 * - Revoke = unpair (bukan hapus booth): fingerprint dibersihkan, device
 *   di-revoke, token pairing kedaluwarsa, sesi kiosk ditutup, lalu audit.
 * - Aksi destruktif/kritis (revoke, ganti harga, maintenance, PIN) ditulis ke
 *   `activity_logs` di dalam transaksi memakai `writeAuditLogTx` (fail-closed).
 */
import { and, eq, isNull, isNotNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { booths, devices, getDatabase, packages, pairingTokens, sessions } from '@snapbox/db';

import { hashPin } from '@/lib/auth/pin';
import { checkEntitlement } from '@/lib/entitlement/entitlement-service';
import { getAuditRequestContext, writeAuditLogTx } from '@/lib/ceo-dashboard/tenant-server';
import {
  createBoothInputSchema,
  fieldErrors,
  safeMachineError,
  setPinLockInputSchema,
  updateBoothInputSchema,
  updateBoothPackageInputSchema,
  type MachineActionResult,
} from '@/lib/owner-dashboard/machine-contract';
import { requireOwnerTenant } from '@/lib/owner-dashboard/machine-server';

import { insertPairingSession } from './pairing-session';

const fail = safeMachineError;

function revalidateBooth(boothId?: string) {
  revalidatePath('/owner-dashboard/machines');
  if (boothId) revalidatePath(`/owner-dashboard/machines/${boothId}`);
}

/** Membuat booth baru beserta sesi pairing QR dalam satu transaksi. */
export async function createBoothWithPairing(input: unknown): Promise<MachineActionResult> {
  const parsed = createBoothInputSchema.safeParse(input);
  if (!parsed.success)
    return fail('INVALID_INPUT', 'Periksa kembali nilai yang diisi.', fieldErrors(parsed.error));
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');

  const entitlement = await checkEntitlement(auth.tenantId, 'deviceQuota');
  if (!entitlement.allowed || typeof entitlement.value !== 'number')
    return fail('LIMIT_REACHED', 'Kuota perangkat plan tidak tersedia.');
  const deviceLimit: number = entitlement.value;

  const db = getDatabase();
  try {
    const created = await db.transaction(async (tx) => {
      const [active] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(devices)
        .where(and(eq(devices.tenantId, auth.tenantId), eq(devices.isRevoked, false)));
      if (deviceLimit !== -1 && Number(active?.value ?? 0) >= deviceLimit) {
        return { atLimit: true as const };
      }

      const [boothRow] = await tx
        .insert(booths)
        .values({
          tenantId: auth.tenantId,
          name: parsed.data.name,
          outletId: parsed.data.outletId ?? null,
          locationTag: parsed.data.locationTag ?? null,
          status: 'UNPAIRED',
        })
        .returning({ id: booths.id });
      if (!boothRow) throw new Error('insert booth gagal');

      await insertPairingSession(tx, {
        tenantId: auth.tenantId,
        boothId: boothRow.id,
        userId: auth.session.userId,
      });

      const context = await getAuditRequestContext();
      await writeAuditLogTx(
        tx,
        {
          actorUserId: auth.session.userId,
          actorEmail: auth.session.email,
          actorRole: 'OWNER',
          tenantId: auth.tenantId,
          action: 'booth.create',
          resourceType: 'booth',
          resourceId: boothRow.id,
          metadata: { name: parsed.data.name },
        },
        context,
      );

      return { atLimit: false as const, boothId: boothRow.id };
    });

    if (created.atLimit) return fail('LIMIT_REACHED', 'Batas perangkat plan telah tercapai.');
    revalidateBooth(created.boothId);
    return { ok: true, boothId: created.boothId, message: 'Mesin dibuat. Kode pairing siap.' };
  } catch {
    return fail('SERVER_ERROR', 'Mesin gagal dibuat.');
  }
}

/** Memperbarui konfigurasi booth yang diizinkan (bukan pairing/device). */
export async function updateBooth(input: unknown): Promise<MachineActionResult> {
  const parsed = updateBoothInputSchema.safeParse(input);
  if (!parsed.success)
    return fail('INVALID_INPUT', 'Periksa kembali nilai yang diisi.', fieldErrors(parsed.error));
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');

  const context = await getAuditRequestContext();
  const db = getDatabase();
  try {
    const outcome = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          maintenanceMode: booths.maintenanceMode,
          paperCount: booths.paperCount,
        })
        .from(booths)
        .where(and(eq(booths.id, parsed.data.id), eq(booths.tenantId, auth.tenantId)))
        .limit(1);
      if (!current) return { notFound: true as const };

      const { id, ...rest } = parsed.data;
      const values: Record<string, unknown> = {
        name: rest.name,
        outletId: rest.outletId ?? null,
        locationTag: rest.locationTag ?? null,
        updatedAt: new Date(),
      };
      if (rest.paperCount !== undefined) values.paperCount = rest.paperCount;
      if (rest.paperCapacity !== undefined) values.paperCapacity = rest.paperCapacity;
      if (rest.maintenanceMode !== undefined) values.maintenanceMode = rest.maintenanceMode;

      await tx
        .update(booths)
        .set(values)
        .where(and(eq(booths.id, id), eq(booths.tenantId, auth.tenantId)));

      if (rest.maintenanceMode !== undefined && rest.maintenanceMode !== current.maintenanceMode) {
        await writeAuditLogTx(
          tx,
          {
            actorUserId: auth.session.userId,
            actorEmail: auth.session.email,
            actorRole: 'OWNER',
            tenantId: auth.tenantId,
            action: rest.maintenanceMode ? 'booth.maintenance_on' : 'booth.maintenance_off',
            resourceType: 'booth',
            resourceId: id,
          },
          context,
        );
      }
      return { notFound: false as const };
    });

    if (outcome.notFound) return fail('NOT_FOUND', 'Mesin tidak ditemukan.');
    revalidateBooth(parsed.data.id);
    return { ok: true, boothId: parsed.data.id, message: 'Konfigurasi mesin disimpan.' };
  } catch {
    return fail('SERVER_ERROR', 'Konfigurasi mesin gagal disimpan.');
  }
}

/**
 * Mengubah harga paket khusus booth ini.
 *
 * Hanya baris yang SUDAH terikat booth ini yang boleh diubah; paket tenant
 * (boothId null) tidak dapat diubah dari sini agar editor booth tidak diam-diam
 * mengubah harga seluruh tenant.
 */
export async function updateBoothPackagePrice(input: unknown): Promise<MachineActionResult> {
  const parsed = updateBoothPackageInputSchema.safeParse(input);
  if (!parsed.success)
    return fail('INVALID_INPUT', 'Harga tidak valid.', fieldErrors(parsed.error));
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');

  const context = await getAuditRequestContext();
  try {
    const outcome = await getDatabase().transaction(async (tx) => {
      const [updated] = await tx
        .update(packages)
        .set({ price: parsed.data.price })
        .where(
          and(
            eq(packages.id, parsed.data.packageId),
            eq(packages.tenantId, auth.tenantId),
            isNotNull(packages.boothId),
          ),
        )
        .returning({ id: packages.id, boothId: packages.boothId });
      if (!updated) return { status: 'not_found' as const };

      await writeAuditLogTx(
        tx,
        {
          actorUserId: auth.session.userId,
          actorEmail: auth.session.email,
          actorRole: 'OWNER',
          tenantId: auth.tenantId,
          action: 'booth.package_price',
          resourceType: 'package',
          resourceId: updated.id,
          metadata: { boothId: updated.boothId, price: parsed.data.price },
        },
        context,
      );
      return { status: 'ok' as const, boothId: updated.boothId };
    });

    if (outcome.status === 'not_found')
      return fail('NOT_FOUND', 'Paket booth tidak ditemukan atau bukan milik booth ini.');
    revalidateBooth(outcome.boothId ?? undefined);
    return {
      ok: true,
      ...(outcome.boothId ? { boothId: outcome.boothId } : {}),
      message: 'Harga paket disimpan.',
    };
  } catch {
    return fail('SERVER_ERROR', 'Harga paket gagal disimpan.');
  }
}

/**
 * Mengaktifkan/menonaktifkan PIN Lock capture.
 *
 * Mengaktifkan mewajibkan PIN 6 digit; PIN di-hash scrypt dan nilai mentahnya
 * tidak pernah disimpan/dikembalikan. Menonaktifkan membersihkan hash.
 */
export async function setPinLock(input: unknown): Promise<MachineActionResult> {
  const parsed = setPinLockInputSchema.safeParse(input);
  if (!parsed.success) return fail('INVALID_INPUT', 'PIN tidak valid.', fieldErrors(parsed.error));
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');
  if (parsed.data.enabled && !parsed.data.pin)
    return fail('INVALID_INPUT', 'PIN 6 digit wajib diisi untuk mengaktifkan PIN Lock.');

  const context = await getAuditRequestContext();
  try {
    const updated = await getDatabase().transaction(async (tx) => {
      const [row] = await tx
        .update(booths)
        .set({
          pinLockEnabled: parsed.data.enabled,
          pinLockPinHash: parsed.data.enabled ? hashPin(parsed.data.pin!) : null,
          updatedAt: new Date(),
        })
        .where(and(eq(booths.id, parsed.data.boothId), eq(booths.tenantId, auth.tenantId)))
        .returning({ id: booths.id });
      if (!row) return null;

      await writeAuditLogTx(
        tx,
        {
          actorUserId: auth.session.userId,
          actorEmail: auth.session.email,
          actorRole: 'OWNER',
          tenantId: auth.tenantId,
          action: parsed.data.enabled ? 'booth.pin_lock_on' : 'booth.pin_lock_off',
          resourceType: 'booth',
          resourceId: row.id,
        },
        context,
      );
      return row;
    });

    if (!updated) return fail('NOT_FOUND', 'Mesin tidak ditemukan.');
    revalidateBooth(parsed.data.boothId);
    return {
      ok: true,
      boothId: parsed.data.boothId,
      message: parsed.data.enabled ? 'PIN Lock diaktifkan.' : 'PIN Lock dinonaktifkan.',
    };
  } catch {
    return fail('SERVER_ERROR', 'PIN Lock gagal diubah.');
  }
}

/**
 * Revoke/unpair perangkat booth.
 *
 * Idempotent: memanggil ulang pada booth yang sudah kosong tetap sukses.
 * Tidak menghapus booth sehingga riwayat transaksi/sesi tetap utuh.
 */
export async function revokeBoothDevice(boothId: unknown): Promise<MachineActionResult> {
  const parsedId = updateBoothInputSchema.shape.id.safeParse(boothId);
  if (!parsedId.success) return fail('INVALID_INPUT', 'Id mesin tidak valid.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');

  const context = await getAuditRequestContext();
  try {
    const found = await getDatabase().transaction(async (tx) => {
      const [booth] = await tx
        .select({ id: booths.id })
        .from(booths)
        .where(and(eq(booths.id, parsedId.data), eq(booths.tenantId, auth.tenantId)))
        .limit(1);
      if (!booth) return false;

      await tx
        .update(devices)
        .set({ isRevoked: true, revokedAt: new Date() })
        .where(and(eq(devices.boothId, booth.id), eq(devices.tenantId, auth.tenantId)));

      await tx
        .update(pairingTokens)
        .set({ used: true, usedAt: new Date() })
        .where(
          and(
            eq(pairingTokens.boothId, booth.id),
            eq(pairingTokens.tenantId, auth.tenantId),
            eq(pairingTokens.used, false),
          ),
        );

      await tx
        .update(sessions)
        .set({ exitAt: new Date(), state: 'CLEANUP' })
        .where(
          and(
            eq(sessions.boothId, booth.id),
            eq(sessions.tenantId, auth.tenantId),
            isNull(sessions.exitAt),
          ),
        );

      await tx
        .update(booths)
        .set({
          deviceFingerprint: null,
          pairingCode: null,
          pairingCodeHash: null,
          pairingCodeExpiresAt: null,
          status: 'UNPAIRED',
          updatedAt: new Date(),
        })
        .where(and(eq(booths.id, booth.id), eq(booths.tenantId, auth.tenantId)));

      await writeAuditLogTx(
        tx,
        {
          actorUserId: auth.session.userId,
          actorEmail: auth.session.email,
          actorRole: 'OWNER',
          tenantId: auth.tenantId,
          action: 'booth.revoke',
          resourceType: 'booth',
          resourceId: booth.id,
        },
        context,
      );
      return true;
    });

    if (!found) return fail('NOT_FOUND', 'Mesin tidak ditemukan.');
    revalidateBooth(parsedId.data);
    return { ok: true, boothId: parsedId.data, message: 'Perangkat dilepas dari mesin ini.' };
  } catch {
    return fail('SERVER_ERROR', 'Perangkat gagal dilepas.');
  }
}

/** Membuat/mengganti sesi pairing QR untuk booth yang sudah ada. */
export async function regeneratePairingSession(input: unknown): Promise<MachineActionResult> {
  const parsed = updateBoothInputSchema.shape.id.safeParse(
    (input as { boothId?: unknown } | null)?.boothId,
  );
  if (!parsed.success) return fail('INVALID_INPUT', 'Id mesin tidak valid.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('UNAUTHORIZED', 'Sesi tidak berwenang.');

  try {
    const outcome = await getDatabase().transaction(async (tx) => {
      const [booth] = await tx
        .select({ id: booths.id })
        .from(booths)
        .where(and(eq(booths.id, parsed.data), eq(booths.tenantId, auth.tenantId)))
        .limit(1);
      if (!booth) return { status: 'not_found' as const };

      await insertPairingSession(tx, {
        tenantId: auth.tenantId,
        boothId: booth.id,
        userId: auth.session.userId,
      });
      return { status: 'ok' as const };
    });

    if (outcome.status === 'not_found') return fail('NOT_FOUND', 'Mesin tidak ditemukan.');
    revalidateBooth(parsed.data);
    return {
      ok: true,
      boothId: parsed.data,
      message: 'Kode pairing baru dibuat (berlaku 10 menit).',
    };
  } catch {
    return fail('SERVER_ERROR', 'Kode pairing gagal dibuat.');
  }
}
