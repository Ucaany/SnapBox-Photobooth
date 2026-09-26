import { and, count, eq } from 'drizzle-orm';
import { booths, devices, getDatabase, tenants } from '@snapbox/db';

import { checkEntitlement } from '@/lib/entitlement/entitlement-service';
import { deriveDeviceStatus, maskDeviceFingerprint } from './device-contract';
import { requireOwnerTenant } from './outlet-server';
import type { OwnerDevicesData } from './device-contract';

export { requireOwnerTenant };

export async function listOwnerDevices(tenantId: string): Promise<OwnerDevicesData> {
  const db = getDatabase();
  const [rows, [active], entitlement, [tenant]] = await Promise.all([
    db
      .select({
        id: devices.id,
        boothId: booths.id,
        boothName: booths.name,
        fingerprint: devices.deviceFingerprint,
        platform: devices.platform,
        appVersion: devices.appVersion,
        lastHeartbeatAt: devices.lastHeartbeatAt,
        boothStatus: booths.status,
        maintenanceMode: booths.maintenanceMode,
      })
      .from(devices)
      .innerJoin(booths, and(eq(booths.id, devices.boothId), eq(booths.tenantId, tenantId)))
      .where(and(eq(devices.tenantId, tenantId), eq(devices.isRevoked, false)))
      .orderBy(booths.name),
    db
      .select({ value: count(devices.id) })
      .from(devices)
      .where(and(eq(devices.tenantId, tenantId), eq(devices.isRevoked, false))),
    checkEntitlement(tenantId, 'deviceQuota'),
    db
      .select({ addOnDevices: tenants.addOnDevices })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1),
  ]);

  const now = Date.now();
  return {
    devices: rows.map((row) => {
      const heartbeat = row.lastHeartbeatAt?.toISOString() ?? null;
      return {
        id: row.id,
        boothId: row.boothId,
        boothName: row.boothName,
        fingerprintMasked: maskDeviceFingerprint(row.fingerprint),
        platform: row.platform,
        appVersion: row.appVersion,
        lastHeartbeatAt: heartbeat,
        status: deriveDeviceStatus(row.boothStatus, row.maintenanceMode, heartbeat, now),
      };
    }),
    quota: {
      used: Number(active?.value ?? 0),
      limit:
        entitlement.allowed && typeof entitlement.value === 'number' ? entitlement.value : null,
    },
    addOnDevices: tenant?.addOnDevices ?? 0,
  };
}
