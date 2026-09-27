/**
 * Verifikasi kredensial perangkat terhadap baris `devices`.
 *
 * Bagian murni (pencetakan, hashing, tanda tangan) ada di `device-token.ts`.
 * Modul ini hanya menjawab satu pertanyaan: "token dan fingerprint ini milik
 * perangkat yang sedang aktif?" — dan jawabannya SELALU diturunkan dari DB,
 * tidak pernah dari body permintaan.
 */
import 'server-only';

import { timingSafeEqual } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import { devices, getDatabase } from '@snapbox/db';

import { deviceSecret, hashDeviceToken, signDeviceToken } from './device-token';
/** Baris perangkat yang diAutentikasi. */
export interface AuthenticatedDevice {
  readonly deviceId: string;
  readonly boothId: string;
  readonly tenantId: string;
  readonly fingerprint: string;
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Mengautentikasi token perangkat dan mengembalikan baris `devices`-nya.
 *
 * Mengembalikan `null` untuk SEMUA kegagalan — token salah, perangkat dicabut,
 * atau baris tidak ada — supaya pemanggil tidak bisa memakai perbedaan respons
 * untuk memetakan perangkat mana yang ada.
 *
 * @param fingerprint Fingerprint yang dikirim perangkat. WAJIB cocok dengan
 *   `devices.device_fingerprint`; inilah yang mencegah token perangkat yang
 *   dicuri dari dipakai di mesin lain.
 */
export async function authenticateDevice(
  token: string,
  fingerprint: string,
): Promise<AuthenticatedDevice | null> {
  const segments = token.split('.');
  if (segments.length !== 2) return null;

  const [payload, signature] = segments as [string, string];
  if (!constantTimeEquals(signature, signDeviceToken(payload, deviceSecret()))) return null;

  const rows = await getDatabase()
    .select({
      deviceId: devices.id,
      boothId: devices.boothId,
      tenantId: devices.tenantId,
      fingerprint: devices.deviceFingerprint,
      tokenHash: devices.sessionJwtHash,
      revokedAt: devices.revokedAt,
    })
    .from(devices)
    .where(
      and(
        eq(devices.isRevoked, false),
        eq(devices.deviceFingerprint, fingerprint),
        eq(devices.sessionJwtHash, hashDeviceToken(token)),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row || row.revokedAt !== null || !row.tokenHash) return null;

  return {
    deviceId: row.deviceId,
    boothId: row.boothId,
    tenantId: row.tenantId,
    fingerprint: row.fingerprint,
  };
}
