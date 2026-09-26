import { z } from 'zod';
import {
  normalizePromoCode,
  PROMO_TYPES,
  type PromoRow as GlobalPromoRow,
} from '@/lib/ceo-dashboard/promo-contract';

export const MAX_BATCH = 500;
const money = z
  .union([z.string(), z.number()])
  .transform(String)
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0, 'Nilai tidak valid.');
const fields = z
  .object({
    name: z.union([z.string(), z.null()]).transform((v) => v?.trim() || null),
    code: z
      .string()
      .transform(normalizePromoCode)
      .refine((v) => /^[A-Z0-9]{4,20}$/.test(v), 'Kode 4-20 karakter alfanumerik.'),
    type: z.enum(PROMO_TYPES),
    value: money,
    minPurchase: money,
    validFrom: z.string().datetime({ offset: true }),
    validUntil: z.string().datetime({ offset: true }),
    quotaTotal: z.union([z.number().int().min(1), z.null()]),
    quotaPerCustomer: z.number().int().min(1),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.type === 'PERCENTAGE' && Number(v.value) > 100)
      c.addIssue({ code: 'custom', path: ['value'], message: 'Maksimal 100%.' });
    if (v.validFrom >= v.validUntil)
      c.addIssue({ code: 'custom', path: ['validUntil'], message: 'Periode tidak valid.' });
  });
export const promoCreateSchema = fields;
export const promoUpdateSchema = fields.extend({
  promoId: z.string().uuid(),
  quotaUsed: z.number().int().min(0),
});
export const promoToggleSchema = z.object({ promoId: z.string().uuid(), isActive: z.boolean() });
export const promoDeleteSchema = z.object({ promoId: z.string().uuid() });
export const batchSchema = z.object({
  template: fields,
  count: z.number().int().min(1).max(MAX_BATCH),
});
export const redeemSchema = z.object({
  code: z.string().transform(normalizePromoCode),
  purchaseAmount: money,
  customerEmail: z
    .string()
    .email()
    .transform((v) => v.trim().toLowerCase())
    .nullable(),
  transactionId: z.string().uuid().nullable().optional(),
});
export type OwnerPromoRow = GlobalPromoRow & { redemptionCount: number };
export type PromoRow = OwnerPromoRow;
export type PromoActionResult =
  | { ok: true; message: string; promoId?: string; csv?: string }
  | { ok: false; code: string; message: string };
export function discountCents(type: string, value: string, purchaseCents: number): number {
  return Math.min(
    purchaseCents,
    type === 'PERCENTAGE'
      ? Math.floor((purchaseCents * Number(value)) / 100)
      : Math.round(Number(value) * 100),
  );
}
export function csvCell(value: unknown): string {
  const s = String(value ?? '').replace(/^[=+\-@]/, "'$&");
  return `"${s.replaceAll('"', '""')}"`;
}
export function makeCode(used: Set<string>, random = Math.random): string {
  for (let i = 0; i < 20; i++) {
    const code = Array.from(
      { length: 10 },
      () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(random() * 36)],
    ).join('');
    if (!used.has(code)) return code;
  }
  throw new Error('CODE_COLLISION');
}
