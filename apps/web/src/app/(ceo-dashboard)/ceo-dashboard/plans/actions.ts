/**
 * Server action editor plan (PRD Task 1.5).
 *
 * Urutan tetap, sama seperti modul tenant (Task 1.4):
 * 1. otorisasi CEO dari sesi + DB (`requireCeo`),
 * 2. validasi input dengan skema kontrak (input browser tidak dipercaya),
 * 3. baca row canonical dari DB,
 * 4. mutasi satu row `plans`,
 * 5. audit `plan.update`,
 * 6. `revalidatePath` rute yang terpengaruh.
 *
 * `tier`, `id`, `createdAt`, dan `isActive` TIDAK pernah diubah dari body:
 * tier immutable dan penghapusan plan berada di luar scope Task 1.5.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

import { getDatabase, plans } from '@snapbox/db';

import {
  diffPlanFields,
  PLAN_FEATURE_FIELDS,
  planUpdateInputSchema,
  type PlanActionResult,
} from '@/lib/ceo-dashboard/plan-contract';
import {
  getPlanForUpdateOr404,
  requireCeo,
  TenantServerError,
  toEditablePlan,
} from '@/lib/ceo-dashboard/plan-server';
import {
  getAuditRequestContext,
  PLAN_AUDIT_ACTIONS,
  writeAuditLogTx,
} from '@/lib/ceo-dashboard/tenant-server';

function failure(
  code: Extract<PlanActionResult, { ok: false }>['code'],
  message: string,
  fieldErrors?: Record<string, string>,
): PlanActionResult {
  return { ok: false, code, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

/**
 * Menyimpan perubahan harga dan feature entitlement satu plan.
 *
 * Harga subscription tenant existing tidak ditulis ulang: PRD baris 354
 * menyatakan harga baru berlaku untuk tenant baru dan renewal. Karena itu action
 * ini hanya menyentuh row `plans`, tidak ada baris `b2b_subscriptions`.
 */
export async function updatePlan(input: unknown): Promise<PlanActionResult> {
  const parsed = planUpdateInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.') || 'form';
      const isFeaturePath =
        issue.path.length === 1 && PLAN_FEATURE_FIELDS.some((field) => field.key === issue.path[0]);
      const key = isFeaturePath ? `features.${path}` : path;
      fieldErrors[key] ??= issue.message;
    }
    return failure('INVALID_INPUT', 'Periksa kembali nilai yang diisi.', fieldErrors);
  }

  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  const data = parsed.data;

  let before;
  try {
    before = toEditablePlan(await getPlanForUpdateOr404(data.planId));
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  const changed = diffPlanFields(before, {
    name: data.name,
    priceMonthly: data.priceMonthly,
    priceYearly: data.priceYearly,
    features: data.features,
  });

  if (changed.length === 0) {
    return {
      ok: true,
      planId: before.id,
      changed: [],
      message: 'Tidak ada perubahan untuk disimpan.',
    };
  }

  const auditContext = await getAuditRequestContext();

  try {
    await getDatabase().transaction(async (tx) => {
      await tx
        .update(plans)
        .set({
          name: data.name,
          priceMonthly: data.priceMonthly,
          priceYearly: data.priceYearly,
          features: data.features,
          updatedAt: new Date(),
        })
        .where(eq(plans.id, before.id));

      // Perubahan harga/fitur plan adalah high-risk: audit ikut transaksi supaya
      // tidak ada perubahan harga tanpa jejak (PRD Task 1.8).
      await writeAuditLogTx(
        tx,
        {
          actorUserId: session.userId,
          actorEmail: session.email,
          actorRole: 'CEO',
          tenantId: null,
          action: PLAN_AUDIT_ACTIONS.update,
          resourceType: 'plan',
          resourceId: before.id,
          metadata: { tier: before.tier, changed },
        },
        auditContext,
      );
    });
  } catch {
    return failure('SERVER_ERROR', 'Perubahan plan gagal disimpan. Coba lagi.');
  }

  revalidatePath('/ceo-dashboard/plans');
  revalidatePath('/ceo-dashboard/tenants/new');

  return {
    ok: true,
    planId: before.id,
    changed,
    message: `Plan ${data.name} tersimpan (${changed.length} field berubah).`,
  };
}
