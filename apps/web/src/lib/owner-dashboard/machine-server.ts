/**
 * Pembacaan server Machine Manager (PRD Task 2.3).
 *
 * Semua query di sini tenant-scoped dan TIDAK PERNAH menerima `tenantId` dari
 * klien. `requireOwnerTenant` diimpor dari modul outlet supaya hanya ada satu
 * kebijakan otorisasi Owner di repo.
 *
 * Kolom sensitif (`pairing_code_hash`, `*_pin_hash`, `session_jwt_hash`) tidak
 * pernah masuk proyeksi select, sehingga tidak mungkin bocor lewat serialisasi.
 */
import { and, count, desc, eq } from 'drizzle-orm';
import { booths, devices, getDatabase, outlets, packages, sessions } from '@snapbox/db';

import { checkEntitlement } from '@/lib/entitlement/entitlement-service';
import { requireOwnerTenant } from './outlet-server';
import {
  deriveDisplayStatus,
  machineIdSchema,
  maskFingerprint,
  type BoothPackageRow,
  type BoothSessionRow,
  type MachineDetail,
  type MachineListData,
  type MachineListRow,
} from './machine-contract';

export { requireOwnerTenant };

const SESSION_HISTORY_LIMIT = 15;

type BoothScalars = {
  id: string;
  name: string;
  outletId: string | null;
  locationTag: string | null;
  status: string;
  lastHeartbeatAt: Date | null;
  paperCount: number;
  paperCapacity: number;
  maintenanceMode: boolean;
  pinLockEnabled: boolean;
  deviceFingerprint: string | null;
  appVersion: string | null;
  platform: string | null;
  createdAt: Date;
};

function toListRow(
  row: BoothScalars & { outletName: string | null },
  nowMs: number,
): MachineListRow {
  return {
    id: row.id,
    name: row.name,
    outletId: row.outletId,
    outletName: row.outletName,
    locationTag: row.locationTag,
    status: row.status,
    displayStatus: deriveDisplayStatus(
      row.status,
      row.lastHeartbeatAt?.toISOString() ?? null,
      row.maintenanceMode,
      nowMs,
    ),
    lastHeartbeatAt: row.lastHeartbeatAt?.toISOString() ?? null,
    paperCount: row.paperCount,
    paperCapacity: row.paperCapacity,
    maintenanceMode: row.maintenanceMode,
    pinLockEnabled: row.pinLockEnabled,
    deviceFingerprintMasked: maskFingerprint(row.deviceFingerprint),
    appVersion: row.appVersion,
    platform: row.platform,
  };
}

/** Daftar booth tenant + kuota device + pilihan outlet untuk form. */
export async function listOwnerMachines(
  tenantId: string,
  nowMs: number = Date.now(),
): Promise<MachineListData> {
  const db = getDatabase();
  const [rows, outletRows, quota] = await Promise.all([
    db
      .select({
        id: booths.id,
        name: booths.name,
        outletId: booths.outletId,
        outletName: outlets.name,
        locationTag: booths.locationTag,
        status: booths.status,
        lastHeartbeatAt: booths.lastHeartbeatAt,
        paperCount: booths.paperCount,
        paperCapacity: booths.paperCapacity,
        maintenanceMode: booths.maintenanceMode,
        pinLockEnabled: booths.pinLockEnabled,
        deviceFingerprint: booths.deviceFingerprint,
        appVersion: booths.appVersion,
        platform: booths.platform,
        createdAt: booths.createdAt,
      })
      .from(booths)
      .leftJoin(outlets, and(eq(outlets.id, booths.outletId), eq(outlets.tenantId, tenantId)))
      .where(eq(booths.tenantId, tenantId))
      .orderBy(booths.name),
    db
      .select({ id: outlets.id, name: outlets.name })
      .from(outlets)
      .where(and(eq(outlets.tenantId, tenantId), eq(outlets.isActive, true)))
      .orderBy(outlets.name),
    machineQuota(tenantId),
  ]);

  return { booths: rows.map((row) => toListRow(row, nowMs)), quota, outlets: outletRows };
}

/**
 * Kuota device aktif vs entitlement plan. `-1` berarti tanpa batas; `null`
 * berarti entitlement tidak bisa dievaluasi (UI menampilkan "Tidak tersedia").
 */
export async function machineQuota(tenantId: string) {
  const [[active], entitlement] = await Promise.all([
    getDatabase()
      .select({ value: count(devices.id) })
      .from(devices)
      .where(and(eq(devices.tenantId, tenantId), eq(devices.isRevoked, false))),
    checkEntitlement(tenantId, 'deviceQuota'),
  ]);
  return {
    used: Number(active?.value ?? 0),
    limit: entitlement.allowed && typeof entitlement.value === 'number' ? entitlement.value : null,
  };
}

/** Detail satu booth; `null` bila id tidak sah, tidak ada, atau milik tenant lain. */
export async function getOwnerMachine(
  tenantId: string,
  id: string,
  nowMs: number = Date.now(),
): Promise<MachineDetail | null> {
  if (!machineIdSchema.safeParse(id).success) return null;
  const db = getDatabase();
  const [booth] = await db
    .select({
      id: booths.id,
      name: booths.name,
      outletId: booths.outletId,
      outletName: outlets.name,
      locationTag: booths.locationTag,
      status: booths.status,
      lastHeartbeatAt: booths.lastHeartbeatAt,
      paperCount: booths.paperCount,
      paperCapacity: booths.paperCapacity,
      paperAlertThresholdPct: booths.paperAlertThresholdPct,
      maintenanceMode: booths.maintenanceMode,
      pinLockEnabled: booths.pinLockEnabled,
      deviceFingerprint: booths.deviceFingerprint,
      appVersion: booths.appVersion,
      platform: booths.platform,
      createdAt: booths.createdAt,
    })
    .from(booths)
    .leftJoin(outlets, and(eq(outlets.id, booths.outletId), eq(outlets.tenantId, tenantId)))
    .where(and(eq(booths.id, id), eq(booths.tenantId, tenantId)))
    .limit(1);
  if (!booth) return null;

  const [packageRows, sessionRows] = await Promise.all([
    db
      .select({
        id: packages.id,
        name: packages.name,
        price: packages.price,
        boothId: packages.boothId,
        isActive: packages.isActive,
      })
      .from(packages)
      .where(and(eq(packages.tenantId, tenantId), eq(packages.isActive, true)))
      .orderBy(packages.sortOrder, packages.name),
    db
      .select({
        id: sessions.id,
        state: sessions.state,
        actor: sessions.actor,
        enterAt: sessions.enterAt,
        exitAt: sessions.exitAt,
        durationMs: sessions.durationMs,
      })
      .from(sessions)
      .where(and(eq(sessions.boothId, id), eq(sessions.tenantId, tenantId)))
      .orderBy(desc(sessions.enterAt))
      .limit(SESSION_HISTORY_LIMIT),
  ]);

  const boothPackages: BoothPackageRow[] = packageRows
    .filter((row) => row.boothId === id || row.boothId === null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      price: row.price,
      isOverride: row.boothId === id,
      isActive: row.isActive,
    }));

  const sessionHistory: BoothSessionRow[] = sessionRows.map((row) => ({
    id: row.id,
    state: row.state,
    actor: row.actor,
    enterAt: row.enterAt.toISOString(),
    exitAt: row.exitAt?.toISOString() ?? null,
    durationMs: row.durationMs,
  }));

  return {
    id: booth.id,
    name: booth.name,
    outletId: booth.outletId,
    outletName: booth.outletName,
    locationTag: booth.locationTag,
    status: booth.status,
    displayStatus: deriveDisplayStatus(
      booth.status,
      booth.lastHeartbeatAt?.toISOString() ?? null,
      booth.maintenanceMode,
      nowMs,
    ),
    deviceFingerprintMasked: maskFingerprint(booth.deviceFingerprint),
    lastHeartbeatAt: booth.lastHeartbeatAt?.toISOString() ?? null,
    paperCount: booth.paperCount,
    paperCapacity: booth.paperCapacity,
    paperAlertThresholdPct: booth.paperAlertThresholdPct,
    maintenanceMode: booth.maintenanceMode,
    pinLockEnabled: booth.pinLockEnabled,
    appVersion: booth.appVersion,
    platform: booth.platform,
    createdAt: booth.createdAt.toISOString(),
    packages: boothPackages,
    sessions: sessionHistory,
  };
}
