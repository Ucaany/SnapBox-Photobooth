import { z } from 'zod';

/**
 * Target broadcast: `all` ATAU daftar tenant terpilih, tidak keduanya.
 *
 * `tenantIds` disengaja tidak ada pada cabang `all` dan wajib pada cabang
 * `selected`; `.strict()` menolak field berlebih sehingga kombinasi campuran
 * gagal validasi alih-alih diam-diam dipakai sebagian. Inilah satu-satunya
 * representasi target; `broadcast-server.ts` membaca `targetAll` + `tenantIds`.
 */
export const broadcastTargetSchema = z.discriminatedUnion('targetAll', [
  z.object({ targetAll: z.literal(true) }).strict(),
  z
    .object({
      targetAll: z.literal(false),
      tenantIds: z
        .array(z.string().uuid())
        .min(1)
        .max(500)
        .transform((ids) => [...new Set(ids.map((id) => id.toLowerCase()))]),
    })
    .strict(),
]);
export type BroadcastTarget = z.infer<typeof broadcastTargetSchema>;

export const broadcastInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    message: z.string().trim().min(12).max(280),
  })
  .and(broadcastTargetSchema);
export type BroadcastInput = z.infer<typeof broadcastInputSchema>;

export const BROADCAST_ACTION_ERROR_CODES = [
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'INVALID_TARGET',
  'NOT_FOUND',
  'SERVER_ERROR',
  'DELIVERY_ERROR',
  'DELIVERY_FAILED',
] as const;
export type BroadcastActionErrorCode = (typeof BROADCAST_ACTION_ERROR_CODES)[number];

export type BroadcastActionResult =
  | {
      readonly ok: true;
      readonly broadcastId: string;
      readonly recipientCount: number;
      readonly targetTenantCount?: number;
      readonly targetCount?: number;
      readonly realtimePublished?: boolean;
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly code: BroadcastActionErrorCode;
      readonly message: string;
      readonly fieldErrors?: Readonly<Record<string, string>>;
    };

export interface BroadcastTenantOption {
  readonly id: string;
  readonly companyName: string;
  readonly status: string;
  readonly planTier: string;
  readonly recipientCount: number;
}
export interface BroadcastHistoryRow {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly targetAll: boolean;
  readonly targetCount: number;
  readonly recipientCount: number;
  readonly createdAt: string;
}
export function collectBroadcastIssues(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  return Object.fromEntries(
    issues.map((issue) => [issue.path.join('.') || 'value', issue.message]),
  );
}
