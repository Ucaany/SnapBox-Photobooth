import { z } from 'zod';

export const deviceIdSchema = z.string().uuid();

export type OwnerDeviceRow = {
  id: string;
  boothId: string;
  boothName: string;
  fingerprintMasked: string;
  platform: string | null;
  appVersion: string | null;
  lastHeartbeatAt: string | null;
  status: 'ONLINE' | 'OFFLINE';
};

export type OwnerDevicesData = {
  devices: OwnerDeviceRow[];
  quota: { used: number; limit: number | null };
  addOnDevices: number;
};

export function maskDeviceFingerprint(value: string): string {
  return value.length < 8 ? '••••' : `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function deriveDeviceStatus(
  status: string,
  maintenanceMode: boolean,
  heartbeatAt: string | null,
  nowMs = Date.now(),
): 'ONLINE' | 'OFFLINE' {
  return !maintenanceMode &&
    status !== 'MAINTENANCE' &&
    heartbeatAt !== null &&
    nowMs - Date.parse(heartbeatAt) < 90_000
    ? 'ONLINE'
    : 'OFFLINE';
}
