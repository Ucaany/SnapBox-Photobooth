'use server';

export { batchGenerate as batchGeneratePromos };
import { and, eq, sql } from 'drizzle-orm';
import { getDatabase, promos, promoRedemptions } from '@snapbox/db';
import { revalidatePath } from 'next/cache';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';
import {
  batchSchema,
  csvCell,
  makeCode,
  promoCreateSchema,
  promoDeleteSchema,
  promoToggleSchema,
  promoUpdateSchema,
  redeemSchema,
  discountCents,
  type PromoActionResult,
} from '@/lib/owner-dashboard/promo-contract';
import { hasPromoEntitlement } from '@/lib/owner-dashboard/promo-server';
const fail = (code: string, message: string): PromoActionResult => ({ ok: false, code, message });
const refresh = () => revalidatePath('/owner-dashboard/promos');
async function auth(advanced = false) {
  const a = await requireOwnerTenant();
  return a && (await hasPromoEntitlement(a.tenantId, advanced)) ? a : null;
}
export async function createPromo(input: unknown): Promise<PromoActionResult> {
  const p = promoCreateSchema.safeParse(input);
  if (!p.success) return fail('INVALID_INPUT', 'Data promo tidak valid.');
  const a = await auth();
  if (!a) return fail('UNAUTHORIZED', 'Akses ditolak.');
  try {
    const [r] = await getDatabase()
      .insert(promos)
      .values({
        ...p.data,
        validFrom: new Date(p.data.validFrom),
        validUntil: new Date(p.data.validUntil),
        tenantId: a.tenantId,
        isGlobal: false,
      })
      .returning({ id: promos.id });
    if (!r) return fail('SERVER_ERROR', 'Promo gagal dibuat.');
    refresh();
    return { ok: true, promoId: r.id, message: 'Promo dibuat.' };
  } catch {
    return fail('CONFLICT', 'Kode promo sudah digunakan.');
  }
}
export async function updatePromo(input: unknown): Promise<PromoActionResult> {
  const p = promoUpdateSchema.safeParse(input);
  if (!p.success) return fail('INVALID_INPUT', 'Data promo tidak valid.');
  const a = await auth();
  if (!a) return fail('UNAUTHORIZED', 'Akses ditolak.');
  const { promoId, quotaUsed, ...data } = p.data;
  if (data.quotaTotal !== null && data.quotaTotal < quotaUsed)
    return fail('INVALID_INPUT', 'Kuota tidak boleh di bawah pemakaian.');
  try {
    const [r] = await getDatabase()
      .update(promos)
      .set({ ...data, validFrom: new Date(data.validFrom), validUntil: new Date(data.validUntil) })
      .where(and(eq(promos.id, promoId), eq(promos.tenantId, a.tenantId)))
      .returning({ id: promos.id });
    if (!r) return fail('NOT_FOUND', 'Promo tidak ditemukan.');
    refresh();
    return { ok: true, promoId, message: 'Promo diperbarui.' };
  } catch {
    return fail('CONFLICT', 'Kode promo sudah digunakan.');
  }
}
export async function togglePromo(input: unknown): Promise<PromoActionResult> {
  const p = promoToggleSchema.safeParse(input);
  if (!p.success) return fail('INVALID_INPUT', 'Data tidak valid.');
  const a = await auth();
  if (!a) return fail('UNAUTHORIZED', 'Akses ditolak.');
  const [r] = await getDatabase()
    .update(promos)
    .set({ isActive: p.data.isActive })
    .where(and(eq(promos.id, p.data.promoId), eq(promos.tenantId, a.tenantId)))
    .returning({ id: promos.id });
  if (!r) return fail('NOT_FOUND', 'Promo tidak ditemukan.');
  refresh();
  return { ok: true, promoId: r.id, message: 'Status promo diperbarui.' };
}
export async function deletePromo(input: unknown): Promise<PromoActionResult> {
  const p = promoDeleteSchema.safeParse(input);
  if (!p.success) return fail('INVALID_INPUT', 'Data tidak valid.');
  const a = await auth();
  if (!a) return fail('UNAUTHORIZED', 'Akses ditolak.');
  const [r] = await getDatabase()
    .update(promos)
    .set({ isActive: false })
    .where(and(eq(promos.id, p.data.promoId), eq(promos.tenantId, a.tenantId)))
    .returning({ id: promos.id });
  if (!r) return fail('NOT_FOUND', 'Promo tidak ditemukan.');
  refresh();
  return { ok: true, promoId: r.id, message: 'Promo dinonaktifkan.' };
}
export async function batchGenerate(input: unknown): Promise<PromoActionResult> {
  const p = batchSchema.safeParse(input);
  if (!p.success) return fail('INVALID_INPUT', 'Batch tidak valid.');
  const a = await auth(true);
  if (!a) return fail('UNAUTHORIZED', 'Akses ditolak.');
  const db = getDatabase();
  const used = new Set<string>();
  try {
    const rows = Array.from({ length: p.data.count }, () => {
      const code = makeCode(used);
      used.add(code);
      return {
        ...p.data.template,
        code,
        validFrom: new Date(p.data.template.validFrom),
        validUntil: new Date(p.data.template.validUntil),
        tenantId: a.tenantId,
        isGlobal: false,
      };
    });
    await db.insert(promos).values(rows);
    refresh();
    return {
      ok: true,
      message: 'Batch dibuat.',
      csv: [
        'code,name,type,value,validFrom,validUntil',
        ...rows.map((r) =>
          [r.code, r.name, r.type, r.value, r.validFrom, r.validUntil].map(csvCell).join(','),
        ),
      ].join('\n'),
    };
  } catch {
    return fail('CONFLICT', 'Batch gagal dibuat.');
  }
}
export async function redeemPromo(
  input: unknown,
): Promise<PromoActionResult & { discountCents?: number; finalCents?: number }> {
  const p = redeemSchema.safeParse(input);
  if (!p.success) return fail('INVALID_INPUT', 'Penukaran tidak valid.');
  const a = await requireOwnerTenant();
  if (!a) return fail('UNAUTHORIZED', 'Akses ditolak.');
  if (!(await hasPromoEntitlement(a.tenantId))) return fail('UNAUTHORIZED', 'Akses ditolak.');
  try {
    return await getDatabase().transaction(async (tx) => {
      const [promo] = await tx.execute(
        sql`select * from promos where tenant_id = ${a.tenantId} and lower(code) = lower(${p.data.code}) and is_active = true for update`,
      );
      if (!promo) return fail('NOT_FOUND', 'Promo tidak ditemukan.');
      const row = promo as Record<string, unknown>;
      const now = Date.now();
      const validFrom = String(row.valid_from);
      const validUntil = String(row.valid_until);
      const quotaTotal = row.quota_total === null ? null : Number(row.quota_total);
      if (
        now < new Date(validFrom).getTime() ||
        now >= new Date(validUntil).getTime() ||
        Number(p.data.purchaseAmount) < Number(row.min_purchase) ||
        (quotaTotal !== null && Number(row.quota_used) >= quotaTotal)
      )
        return fail('CONFLICT', 'Promo tidak berlaku.');
      const quotaPerCustomer = Number(row.quota_per_customer);
      if (quotaPerCustomer > 1 && !p.data.customerEmail)
        return fail('INVALID_INPUT', 'Email wajib diisi.');
      if (p.data.customerEmail) {
        const [c] = await tx.execute(
          sql`select count(*) as count from promo_redemptions where promo_id = ${String(row.id)} and customer_email = ${p.data.customerEmail}`,
        );
        const count = Number((c as Record<string, unknown> | undefined)?.count ?? 0);
        if (count >= quotaPerCustomer) return fail('CONFLICT', 'Batas customer tercapai.');
      }
      const cents = discountCents(
        String(row.type),
        String(row.value),
        Math.round(Number(p.data.purchaseAmount) * 100),
      );
      await tx.insert(promoRedemptions).values({
        promoId: String(row.id),
        tenantId: a.tenantId,
        customerEmail: p.data.customerEmail ?? null,
        transactionId: p.data.transactionId ?? null,
        discountApplied: (cents / 100).toFixed(2),
      });
      await tx
        .update(promos)
        .set({ quotaUsed: sql`${promos.quotaUsed} + 1` })
        .where(eq(promos.id, String(row.id)));
      return {
        ok: true,
        message: 'Promo diterapkan.',
        discountCents: cents,
        finalCents: Math.round(Number(p.data.purchaseAmount) * 100) - cents,
      };
    });
  } catch {
    return fail('SERVER_ERROR', 'Promo gagal diterapkan.');
  }
}
