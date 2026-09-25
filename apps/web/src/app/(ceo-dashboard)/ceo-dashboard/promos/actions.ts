/**
 * Server action CRUD promo global CEO (PRD Task 1.10).
 *
 * Urutan tetap, sama seperti modul tenant (Task 1.4) dan plan (Task 1.5):
 * 1. validasi input dengan skema kontrak (input browser tidak dipercaya),
 * 2. otorisasi CEO dari sesi + DB (`requireCeo`),
 * 3. baca row canonical dari DB,
 * 4. mutasi di dalam satu transaksi,
 * 5. audit `writeAuditLogTx` DI DALAM transaksi (fail-closed, PRD Bab 8.8),
 * 6. `revalidatePath('/ceo-dashboard/promos')`.
 *
 * `tenantId`, `isGlobal`, dan `quotaUsed` TIDAK pernah datang dari body:
 * create memaksa `tenantId = null` + `isGlobal = true` + `quotaUsed = 0`, dan
 * `quotaUsed` hanya dibaca dari row canonical saat update.
 *
 * Delete diwujudkan sebagai nonaktifkan (soft delete) supaya histori redemption
 * dan audit tetap utuh; action tetap dinamai `promo.delete` untuk intent pengguna.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';

import { getDatabase, promos } from '@snapbox/db';

import {
  promoCreateInputSchema,
  promoDeleteInputSchema,
  promoToggleInputSchema,
  promoUpdateInputSchema,
  type PromoActionResult,
  type PromoActionErrorCode,
} from '@/lib/ceo-dashboard/promo-contract';
import {
  findPromoByCode,
  getGlobalPromoForUpdateOr404,
  PROMO_AUDIT_ACTIONS,
} from '@/lib/ceo-dashboard/promo-server';
import {
  getAuditRequestContext,
  requireCeo,
  TenantServerError,
  writeAuditLogTx,
} from '@/lib/ceo-dashboard/tenant-server';

function failure(
  code: PromoActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
): PromoActionResult {
  return { ok: false, code, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

/** Peta issue Zod ke field error stabil; kunci ganda dipertahankan yang pertama. */
function collectIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || 'form';
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

/** Menerjemahkan error server menjadi hasil aman; tidak membocorkan detail DB. */
function serverFailure(error: unknown): PromoActionResult {
  if (error instanceof TenantServerError) return failure(error.code, error.message);
  return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
}

const REVALIDATE_PATH = '/ceo-dashboard/promos';

/** Field bersama create/update; bentuknya sudah kanonik dari skema. */
function toPersistedFields(data: {
  name: string | null;
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: string;
  minPurchase: string;
  validFrom: string;
  validUntil: string;
  quotaTotal: number | null;
  quotaPerCustomer: number;
}) {
  return {
    name: data.name,
    code: data.code,
    type: data.type,
    value: data.value,
    minPurchase: data.minPurchase,
    validFrom: new Date(data.validFrom),
    validUntil: new Date(data.validUntil),
    quotaTotal: data.quotaTotal,
    quotaPerCustomer: data.quotaPerCustomer,
  };
}

/** Membuat voucher platform-wide baru. */
export async function createPromo(input: unknown): Promise<PromoActionResult> {
  const parsed = promoCreateInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_INPUT',
      'Periksa kembali nilai yang diisi.',
      collectIssues(parsed.error.issues),
    );
  }

  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    return serverFailure(error);
  }

  const data = parsed.data;

  try {
    const existing = await findPromoByCode(data.code);
    if (existing) {
      return failure('CONFLICT', `Kode ${data.code} sudah dipakai.`, {
        code: 'Kode sudah dipakai promo lain.',
      });
    }
  } catch {
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  const auditContext = await getAuditRequestContext();
  let createdId: string | null = null;

  try {
    await getDatabase().transaction(async (tx) => {
      const [row] = await tx
        .insert(promos)
        .values({
          tenantId: null,
          isGlobal: true,
          quotaUsed: 0,
          isActive: true,
          ...toPersistedFields(data),
        })
        .returning({ id: promos.id });

      createdId = row?.id ?? null;

      await writeAuditLogTx(
        tx,
        {
          actorUserId: session.userId,
          actorEmail: session.email,
          actorRole: 'CEO',
          tenantId: null,
          action: PROMO_AUDIT_ACTIONS.create,
          resourceType: 'promo',
          resourceId: createdId ?? '',
          metadata: {
            code: data.code,
            type: data.type,
            value: data.value,
            minPurchase: data.minPurchase,
            quotaTotal: data.quotaTotal,
            quotaPerCustomer: data.quotaPerCustomer,
            validFrom: data.validFrom,
            validUntil: data.validUntil,
          },
        },
        auditContext,
      );
    });
  } catch (error) {
    // Unique index `lower(code)` adalah jaring terakhir bila ada balapan.
    if (isUniqueViolation(error)) {
      return failure('CONFLICT', `Kode ${data.code} sudah dipakai.`, {
        code: 'Kode sudah dipakai promo lain.',
      });
    }
    return failure('SERVER_ERROR', 'Promo gagal disimpan. Coba lagi.');
  }

  if (!createdId) return failure('SERVER_ERROR', 'Promo gagal disimpan. Coba lagi.');

  revalidatePath(REVALIDATE_PATH);

  return { ok: true, promoId: createdId, message: `Promo ${data.code} dibuat.` };
}

/** Menyimpan perubahan promo global. */
export async function updatePromo(input: unknown): Promise<PromoActionResult> {
  const parsed = promoUpdateInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_INPUT',
      'Periksa kembali nilai yang diisi.',
      collectIssues(parsed.error.issues),
    );
  }

  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    return serverFailure(error);
  }

  const data = parsed.data;

  let before;
  try {
    before = await getGlobalPromoForUpdateOr404(data.promoId);
  } catch (error) {
    return serverFailure(error);
  }

  // `quotaUsed` selalu dari row canonical, bukan dari body.
  if (data.quotaTotal !== null && data.quotaTotal < before.quotaUsed) {
    return failure('INVALID_INPUT', 'Kuota total tidak boleh di bawah jumlah terpakai.', {
      quotaTotal: `Minimal ${before.quotaUsed} karena sudah terpakai.`,
    });
  }

  try {
    const existing = await findPromoByCode(data.code, before.id);
    if (existing) {
      return failure('CONFLICT', `Kode ${data.code} sudah dipakai.`, {
        code: 'Kode sudah dipakai promo lain.',
      });
    }
  } catch {
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  const auditContext = await getAuditRequestContext();

  try {
    await getDatabase().transaction(async (tx) => {
      await tx
        .update(promos)
        .set(toPersistedFields(data))
        .where(and(eq(promos.id, before.id), eq(promos.isGlobal, true), isNull(promos.tenantId)));

      await writeAuditLogTx(
        tx,
        {
          actorUserId: session.userId,
          actorEmail: session.email,
          actorRole: 'CEO',
          tenantId: null,
          action: PROMO_AUDIT_ACTIONS.update,
          resourceType: 'promo',
          resourceId: before.id,
          metadata: {
            code: data.code,
            previousCode: before.code,
            type: data.type,
            value: data.value,
          },
        },
        auditContext,
      );
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure('CONFLICT', `Kode ${data.code} sudah dipakai.`, {
        code: 'Kode sudah dipakai promo lain.',
      });
    }
    return failure('SERVER_ERROR', 'Perubahan promo gagal disimpan. Coba lagi.');
  }

  revalidatePath(REVALIDATE_PATH);

  return { ok: true, promoId: before.id, message: `Promo ${data.code} tersimpan.` };
}

/** Mengaktifkan atau menonaktifkan promo tanpa menghapus datanya. */
export async function togglePromo(input: unknown): Promise<PromoActionResult> {
  const parsed = promoToggleInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure('INVALID_INPUT', 'Permintaan tidak valid.');
  }

  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    return serverFailure(error);
  }

  const { promoId, isActive } = parsed.data;

  let before;
  try {
    before = await getGlobalPromoForUpdateOr404(promoId);
  } catch (error) {
    return serverFailure(error);
  }

  if (before.isActive === isActive) {
    return {
      ok: true,
      promoId: before.id,
      message: `Promo ${before.code} sudah ${isActive ? 'aktif' : 'nonaktif'}.`,
    };
  }

  const auditContext = await getAuditRequestContext();

  try {
    await getDatabase().transaction(async (tx) => {
      await tx.update(promos).set({ isActive }).where(eq(promos.id, before.id));

      await writeAuditLogTx(
        tx,
        {
          actorUserId: session.userId,
          actorEmail: session.email,
          actorRole: 'CEO',
          tenantId: null,
          action: PROMO_AUDIT_ACTIONS.toggle,
          resourceType: 'promo',
          resourceId: before.id,
          metadata: { code: before.code, isActive },
        },
        auditContext,
      );
    });
  } catch {
    return failure('SERVER_ERROR', 'Status promo gagal diubah. Coba lagi.');
  }

  revalidatePath(REVALIDATE_PATH);

  return {
    ok: true,
    promoId: before.id,
    message: `Promo ${before.code} ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
  };
}

/**
 * Menonaktifkan promo (soft delete) dengan alasan wajib.
 *
 * Idempotent: bila promo sudah nonaktif, tidak ada mutasi/audit baru dan hasil
 * tetap sukses supaya klik ganda tidak menampilkan error.
 */
export async function deletePromo(input: unknown): Promise<PromoActionResult> {
  const parsed = promoDeleteInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_INPUT',
      'Sertakan alasan minimal 4 karakter sebelum menonaktifkan promo.',
      collectIssues(parsed.error.issues),
    );
  }

  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    return serverFailure(error);
  }

  const { promoId, reason } = parsed.data;

  let before;
  try {
    before = await getGlobalPromoForUpdateOr404(promoId);
  } catch (error) {
    return serverFailure(error);
  }

  if (!before.isActive) {
    return {
      ok: true,
      promoId: before.id,
      message: `Promo ${before.code} sudah nonaktif.`,
    };
  }

  const auditContext = await getAuditRequestContext();

  try {
    await getDatabase().transaction(async (tx) => {
      await tx.update(promos).set({ isActive: false }).where(eq(promos.id, before.id));

      await writeAuditLogTx(
        tx,
        {
          actorUserId: session.userId,
          actorEmail: session.email,
          actorRole: 'CEO',
          tenantId: null,
          action: PROMO_AUDIT_ACTIONS.delete,
          resourceType: 'promo',
          resourceId: before.id,
          reason,
          metadata: { code: before.code },
        },
        auditContext,
      );
    });
  } catch {
    return failure('SERVER_ERROR', 'Promo gagal dinonaktifkan. Coba lagi.');
  }

  revalidatePath(REVALIDATE_PATH);

  return {
    ok: true,
    promoId: before.id,
    message: `Promo ${before.code} dinonaktifkan. Kode tidak bisa lagi dipakai di kiosk.`,
  };
}

/** Deteksi pelanggaran unique index Postgres (SQLSTATE 23505). */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === '23505';
}
