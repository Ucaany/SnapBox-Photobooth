/**
 * Event catalog realtime SnapBox (PRD Bab 10.6 + ADR-011).
 *
 * Setiap event membawa `event_id` dan `version`. Handler WAJIB idempotent:
 * event dengan `event_id` yang sudah diproses diabaikan, dan event dengan
 * `version` lebih kecil dari yang terakhir diterapkan di-drop agar urutan
 * penerapan tidak mundur (out-of-order webhook / reconnect realtime).
 */
import { z } from 'zod';

/** Nama channel realtime. Konvensi dari ADR-011. */
export const REALTIME_CHANNELS = {
  booth: (boothId: string) => `booth:${boothId}`,
  tenant: (tenantId: string) => `tenant:${tenantId}`,
  user: (userId: string) => `user:${userId}`,
  broadcastAll: 'broadcast:all',
} as const;

export type RealtimeChannel =
  | ReturnType<typeof REALTIME_CHANNELS.booth>
  | ReturnType<typeof REALTIME_CHANNELS.tenant>
  | ReturnType<typeof REALTIME_CHANNELS.user>
  | typeof REALTIME_CHANNELS.broadcastAll;

/** Daftar nama event. Tambahkan di sini agar katalog tetap satu sumber. */
export const REALTIME_EVENTS = [
  // Siklus hidup device & booth
  'DEVICE_PAIRED',
  'DEVICE_REVOKED',
  'DEVICE_ONLINE',
  'DEVICE_OFFLINE',
  'BOOTH_ONLINE',
  'BOOTH_OFFLINE',
  // Konfigurasi kiosk (hierarki tunggal, ADR-005)
  'CONFIG_UPDATED',
  'THEME_UPDATED',
  'PACKAGE_UPDATED',
  'FRAME_UPDATED',
  'PROMO_UPDATED',
  // Pembayaran (server-authoritative, ADR-002)
  'PAYMENT_PENDING',
  'PAYMENT_PAID',
  'PAYMENT_FAILED',
  // Sesi foto
  'START_CAPTURE',
  'PRINT_STARTED',
  'PRINT_SUCCESS',
  'PRINT_FAILED',
  // Langganan B2B
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_EXPIRING',
  'SUBSCRIPTION_EXPIRED',
  // Operasional
  'LOW_PAPER',
  'MAINTENANCE_MODE_ON',
  'MAINTENANCE_MODE_OFF',
] as const;

export const realtimeEventNameSchema = z.enum(REALTIME_EVENTS);
export type RealtimeEventName = z.infer<typeof realtimeEventNameSchema>;

/**
 * Amplop event realtime.
 *
 * `eventId` sengaja berupa string bebas (bukan UUID) karena bisa berasal dari
 * provider eksternal, mis. id webhook Pakasir, selama unik per nama event.
 */
export const realtimeEventSchema = z.object({
  eventId: z.string().min(1).max(200),
  name: realtimeEventNameSchema,
  /** Naik monoton per resource; dipakai untuk menolak event yang datang terlambat. */
  version: z.number().int().nonnegative(),
  timestamp: z.string().datetime({ offset: true }),
  tenantId: z.string().uuid().nullable(),
  boothId: z.string().uuid().nullable(),
  deviceId: z.string().uuid().nullable(),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

/** Hasil penerapan sebuah event oleh handler. */
export type EventApplyResult =
  | { readonly status: 'applied' }
  | { readonly status: 'duplicate'; readonly reason: 'event_id_seen' }
  | { readonly status: 'stale'; readonly reason: 'version_older'; readonly currentVersion: number };

/**
 * Penjaga idempotensi in-memory untuk handler event.
 *
 * ponytail: memori proses saja, cukup untuk satu instance Next.js. Saat realtime
 * di-hardening (Fase 6) ganti backing-nya dengan tabel `webhook_events` /
 * unique constraint `event_id` di DB, tanpa mengubah pemanggil.
 */
export class EventDeduplicator {
  readonly #seen = new Map<string, number>();
  readonly #maxEntries: number;

  constructor(maxEntries = 5_000) {
    this.#maxEntries = maxEntries;
  }

  /** Menandai event sebagai diproses. `stale` bila versinya lebih tua dari yang tercatat. */
  apply(event: Pick<RealtimeEvent, 'eventId' | 'version'>): EventApplyResult {
    const currentVersion = this.#seen.get(event.eventId);

    if (currentVersion !== undefined) {
      if (event.version < currentVersion) {
        return { status: 'stale', reason: 'version_older', currentVersion };
      }
      return { status: 'duplicate', reason: 'event_id_seen' };
    }

    // Batasi pertumbuhan memori: buang entri tertua saat melewati ambang.
    if (this.#seen.size >= this.#maxEntries) {
      const oldest = this.#seen.keys().next();
      if (!oldest.done) {
        this.#seen.delete(oldest.value);
      }
    }

    this.#seen.set(event.eventId, event.version);
    return { status: 'applied' };
  }

  has(eventId: string): boolean {
    return this.#seen.has(eventId);
  }

  clear(): void {
    this.#seen.clear();
  }
}
