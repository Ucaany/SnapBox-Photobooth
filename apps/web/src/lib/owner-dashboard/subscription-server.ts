import { desc, eq } from 'drizzle-orm';

import { b2bSubscriptions, getDatabase, plans, tenants } from '@snapbox/db';

export async function getOwnerSubscription(tenantId: string) {
  const db = getDatabase();
  const [tenantRows, planRows] = await Promise.all([
    db
      .select({
        id: b2bSubscriptions.id,
        planName: plans.name,
        planTier: b2bSubscriptions.planTier,
        status: b2bSubscriptions.status,
        amount: b2bSubscriptions.amount,
        validFrom: b2bSubscriptions.validFrom,
        validUntil: b2bSubscriptions.validUntil,
        createdAt: b2bSubscriptions.createdAt,
        paidAt: b2bSubscriptions.paidAt,
        invoiceId: b2bSubscriptions.pakasirInvoiceId,
        paymentUrl: b2bSubscriptions.pakasirPaymentUrl,
        monthlyPrice: plans.priceMonthly,
      })
      .from(b2bSubscriptions)
      .innerJoin(plans, eq(b2bSubscriptions.planId, plans.id))
      .where(eq(b2bSubscriptions.tenantId, tenantId))
      .orderBy(desc(b2bSubscriptions.createdAt)),
    db
      .select({
        id: plans.id,
        name: plans.name,
        tier: plans.tier,
        priceMonthly: plans.priceMonthly,
      })
      .from(plans)
      .where(eq(plans.isActive, true)),
  ]);
  const [tenant] = await db
    .select({ addOnDevices: tenants.addOnDevices })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return {
    invoices: tenantRows.map((row) => ({
      ...row,
      amount: Number(row.amount),
      monthlyPrice: Number(row.monthlyPrice),
      validFrom: row.validFrom?.toISOString() ?? null,
      validUntil: row.validUntil?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
      paymentUrl: safePaymentUrl(row.paymentUrl),
    })),
    plans: planRows.map((plan) => ({ ...plan, priceMonthly: Number(plan.priceMonthly) })),
    addOnDevices: tenant?.addOnDevices ?? 0,
  };
}

function safePaymentUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
