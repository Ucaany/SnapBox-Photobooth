import { and, desc, eq, sql } from 'drizzle-orm';
import { getDatabase, promos, promoRedemptions } from '@snapbox/db';
import { checkEntitlement } from '@/lib/entitlement/entitlement-service';
import { derivePromoStatus } from '@/lib/ceo-dashboard/promo-contract';
import type { OwnerPromoRow } from './promo-contract';
export async function hasPromoEntitlement(tenantId: string, advanced = false) {
  const r = await checkEntitlement(tenantId, advanced ? 'promoAdvanced' : 'promoEnabled');
  return r.allowed;
}
export async function listOwnerPromos(tenantId: string): Promise<OwnerPromoRow[]> {
  const rows = await getDatabase()
    .select({ promo: promos, redemptionCount: sql<number>`count(${promoRedemptions.id})` })
    .from(promos)
    .leftJoin(promoRedemptions, eq(promoRedemptions.promoId, promos.id))
    .where(and(eq(promos.tenantId, tenantId), eq(promos.isGlobal, false)))
    .groupBy(promos.id)
    .orderBy(desc(promos.createdAt));
  return rows.map(({ promo, redemptionCount }) => ({
    ...promo,
    value: String(promo.value),
    minPurchase: String(promo.minPurchase),
    validFrom: promo.validFrom.toISOString(),
    validUntil: promo.validUntil.toISOString(),
    createdAt: promo.createdAt.toISOString(),
    status: derivePromoStatus(
      promo.isActive,
      promo.validFrom.toISOString(),
      promo.validUntil.toISOString(),
    ),
    redemptionCount: Number(redemptionCount),
  }));
}
