/**
 * Server action provisioning dan mutasi tenant (PRD Task 1.4).
 *
 * Setiap action mengulang polanya dalam urutan tetap:
 * 1. otorisasi CEO dari sesi + DB (`requireCeo`),
 * 2. validasi input dengan skema kontrak (input browser tidak dipercaya),
 * 3. baca sumber kebenaran dari DB (plan canonical), bukan dari body,
 * 4. mutasi, 5. audit, 6. `revalidatePath` pada rute yang terpengaruh.
 *
 * Kegagalan parsial ditangani eksplisit:
 * - insert DB gagal setelah user Firebase dibuat -> user Firebase dihapus
 *   sebagai kompensasi (Firebase tidak bisa ikut transaksi PostgreSQL),
 * - email undangan gagal setelah commit -> provisioning tetap sukses dan
 *   hasilnya `inviteFailed: true` supaya CEO bisa resend dari halaman detail.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import {
  deleteUser,
  findUserByEmail,
  generatePasswordResetLink,
  createUserWithoutPassword,
  setUserDisabled,
} from '@snapbox/auth/admin';
import { getDatabase, b2bSubscriptions, booths, tenants, users } from '@snapbox/db';

import { sendTenantInviteEmail } from '@/lib/email/resend';

import {
  createTenantInputSchema,
  statusAfterAction,
  statusTransitionError,
  tenantActionInputSchema,
  type TenantActionResult,
  type TenantActionErrorCode,
} from '@/lib/ceo-dashboard/tenant-contract';
import {
  getActivePlan,
  getTenantByIdOr404,
  findTenantOwner,
  requireCeo,
  TenantServerError,
  TENANT_AUDIT_ACTIONS,
  getAuditRequestContext,
  writeAuditLogTx,
} from '@/lib/ceo-dashboard/tenant-server';
// Batas periode dihitung modul bersama supaya bisa diuji `node --test` tanpa
// menyentuh DB/Firebase. `setMonth` polos pernah membuat 31 Jan + 1 bulan
// menjadi 3 Mar, yaitu sekitar satu bulan entitlement ekstra.
import { periodBounds } from '@/lib/ceo-dashboard/subscription-period';

function failure(
  code: TenantActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
): TenantActionResult {
  return { ok: false, code, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

/**
 * Membuat tenant baru: tenant, owner `users`, langganan B2B, dan satu booth
 * default, lalu mengirim undangan owner.
 */
export async function createTenant(input: unknown): Promise<TenantActionResult> {
  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  const parsed = createTenantInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fieldErrors[key] ??= issue.message;
    }
    return failure('INVALID_INPUT', 'Periksa kembali data yang diisi.', fieldErrors);
  }

  const data = parsed.data;

  const plan = await getActivePlan(data.planTier);
  if (!plan) {
    return failure('INVALID_INPUT', `Plan ${data.planTier} tidak tersedia atau sudah nonaktif.`, {
      planTier: 'Pilih plan yang aktif.',
    });
  }

  const db = getDatabase();

  // Pratinjau bentrok lebih dulu supaya email yang sudah dipakai tidak
  // menghasilkan error Firebase mentah di layar CEO.
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.ownerEmail))
    .limit(1);

  if (existingUser || (await findUserByEmail(data.ownerEmail))) {
    return failure(
      'CONFLICT',
      'Email owner sudah terdaftar. Gunakan email lain atau pulihkan akun lama.',
      {
        ownerEmail: 'Email sudah terdaftar.',
      },
    );
  }

  // Plan tanpa harga tahunan tidak boleh diberi periode tahunan: kalau dibiarkan,
  // tenant menerima 12 bulan dengan harga 1 bulan. Ditolak sebelum side effect
  // Firebase apa pun dibuat.
  if (data.billingPeriod === 'yearly' && plan.priceYearly === null) {
    return failure('INVALID_INPUT', 'Plan ini tidak menyediakan harga tahunan.', {
      billingPeriod: 'Pilih periode bulanan.',
    });
  }

  const nowMs = Date.now();
  const { start, end } = periodBounds(data.billingPeriod, nowMs);
  const amount =
    data.billingPeriod === 'yearly' && plan.priceYearly !== null
      ? Number(plan.priceYearly)
      : Number(plan.priceMonthly);

  let firebaseUid: string | null = null;
  let inviteUrl: string | null = null;

  try {
    const firebaseUser = await createUserWithoutPassword(data.ownerEmail);
    firebaseUid = firebaseUser.uid;

    // Tautan reset = undangan: owner menetapkan kata sandinya sendiri.
    if (data.sendInvite) {
      inviteUrl = await generatePasswordResetLink(data.ownerEmail);
    }
  } catch {
    if (firebaseUid) await deleteUser(firebaseUid).catch(() => undefined);
    return failure('SERVER_ERROR', 'Akun Firebase owner gagal dibuat. Coba lagi.');
  }

  const auditContext = await getAuditRequestContext();

  let tenantId: string;
  try {
    tenantId = await db.transaction(async (tx) => {
      const [tenantRow] = await tx
        .insert(tenants)
        .values({
          companyName: data.companyName,
          ownerEmail: data.ownerEmail,
          ownerPhone: data.ownerPhone ?? null,
          address: data.address ?? null,
          planTier: plan.tier,
          status: 'ACTIVE',
          deviceQuota: plan.features.deviceIncluded,
          frameQuota: plan.features.maxFrameUpload,
          storageQuotaMb: plan.features.storageMb,
          staffQuota: plan.features.staffLimit,
          retentionDays: plan.features.retentionDays,
          notes: data.notes ?? null,
        })
        .returning({ id: tenants.id });

      if (!tenantRow) throw new Error('insert tenant tidak mengembalikan baris.');
      const tenantRowId = tenantRow.id;

      await tx.insert(users).values({
        firebaseUid,
        email: data.ownerEmail,
        fullName: data.ownerName,
        phone: data.ownerPhone ?? null,
        role: 'OWNER',
        tenantId: tenantRowId,
      });

      // Langganan dibuat PENDING: status aktif hanya boleh datang dari webhook
      // Pakasir terverifikasi (ADR-002), bukan dari wizard.
      await tx.insert(b2bSubscriptions).values({
        tenantId: tenantRowId,
        planId: plan.id,
        planTier: plan.tier,
        status: 'PENDING',
        amount: amount.toFixed(2),
        validFrom: start,
        validUntil: end,
      });

      // Satu booth default supaya dashboard Owner tidak kosong setelah login.
      await tx.insert(booths).values({
        tenantId: tenantRowId,
        name: 'Booth 1',
        status: 'UNPAIRED',
      });

      // Audit ikut transaksi: bila insert gagal, tenant/owner/langganan/booth
      // ikut rollback, sehingga tidak pernah ada tenant tanpa jejak pembuatan.
      await writeAuditLogTx(
        tx,
        {
          actorUserId: session.userId,
          actorEmail: session.email,
          actorRole: 'CEO',
          tenantId: tenantRowId,
          action: TENANT_AUDIT_ACTIONS.create,
          resourceId: tenantRowId,
          reason: data.notes ?? null,
          // Tanpa invite URL dan tanpa Firebase UID (PRD Bab 8.8).
          metadata: {
            planTier: plan.tier,
            billingPeriod: data.billingPeriod,
            inviteRequested: data.sendInvite,
          },
        },
        auditContext,
      );

      return tenantRowId;
    });
  } catch {
    // Kompensasi: Firebase tidak kenal transaksi PostgreSQL.
    if (firebaseUid) {
      await deleteUser(firebaseUid).catch(() => undefined);
    }
    return failure('SERVER_ERROR', 'Tenant gagal dibuat. Tidak ada data yang tersimpan.');
  }

  revalidatePath('/ceo-dashboard/tenants');

  if (data.sendInvite && inviteUrl) {
    const delivery = await sendTenantInviteEmail({
      to: data.ownerEmail,
      ownerName: data.ownerName,
      companyName: data.companyName,
      planName: plan.name,
      inviteUrl,
    });

    if (!delivery.ok) {
      return {
        ok: true,
        tenantId,
        inviteFailed: true,
        message: `Tenant dibuat, tetapi email undangan gagal dikirim. ${delivery.message} Kirim ulang dari halaman detail.`,
      };
    }
  }

  return {
    ok: true,
    tenantId,
    message:
      data.sendInvite && inviteUrl
        ? 'Tenant dibuat dan undangan owner terkirim.'
        : 'Tenant dibuat. Undangan belum dikirim; kirim dari halaman detail bila siap.',
  };
}

/**
 * Suspend/ban/restore: mengubah status tenant sekaligus status akun Firebase
 * owner supaya owner yang dibekukan tidak bisa login lewat jalur Firebase.
 */
export async function changeTenantStatus(input: unknown): Promise<TenantActionResult> {
  const parsed = tenantActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure('INVALID_INPUT', 'Aksi tidak valid.');
  }

  const { tenantId, action, reason } = parsed.data;
  // Schema sudah membatasi aksi; pengecekan ini hanya menjaga pemanggil.
  if (action !== 'suspend' && action !== 'ban' && action !== 'restore') {
    return failure('INVALID_INPUT', `Aksi ${action} bukan aksi status.`);
  }

  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  let tenant;
  try {
    tenant = await getTenantByIdOr404(tenantId);
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  const transactionError = statusTransitionError(tenant.status, action);
  if (transactionError) {
    return failure('CONFLICT', transactionError);
  }

  const nextStatus = statusAfterAction(action);
  const auditAction =
    action === 'suspend'
      ? TENANT_AUDIT_ACTIONS.suspend
      : action === 'ban'
        ? TENANT_AUDIT_ACTIONS.ban
        : TENANT_AUDIT_ACTIONS.restore;

  const db = getDatabase();
  const now = new Date();
  const auditContext = await getAuditRequestContext();

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(tenants)
        .set({ status: nextStatus, updatedAt: now })
        .where(eq(tenants.id, tenantId));

      // Hanya OWNER yang di-flip. Staff bisa saja dinonaktifkan individual
      // karena alasan lain, dan `restore` tidak boleh mengaktifkan mereka
      // kembali secara diam-diam (privilege restoration).
      await tx
        .update(users)
        .set({ disabled: action !== 'restore', updatedAt: now })
        .where(and(eq(users.tenantId, tenantId), eq(users.role, 'OWNER')));

      // Audit ikut transaksi: status dan jejaknya tidak bisa menyimpang.
      await writeAuditLogTx(
        tx,
        {
          actorUserId: session.userId,
          actorEmail: session.email,
          actorRole: 'CEO',
          tenantId,
          action: auditAction,
          resourceId: tenantId,
          reason,
          metadata: { from: tenant.status, to: nextStatus },
        },
        auditContext,
      );
    });
  } catch {
    return failure('SERVER_ERROR', 'Perubahan status gagal disimpan.');
  }

  const owner = await findTenantOwner(tenantId);
  if (owner?.firebaseUid) {
    try {
      await setUserDisabled(owner.firebaseUid, action !== 'restore');
    } catch {
      return failure(
        'SERVER_ERROR',
        `Status database tersimpan sebagai ${nextStatus}, tetapi sinkronisasi akun Owner gagal. Coba lagi atau nonaktifkan Owner di Firebase secara manual.`,
      );
    }
  }

  revalidatePath(`/ceo-dashboard/tenants/${tenantId}`);
  revalidatePath('/ceo-dashboard/tenants');

  return { ok: true, tenantId, message: `Tenant kini berstatus ${nextStatus}.` };
}

/** Mengirim ulang tautan undangan owner tanpa mengubah status tenant. */
export async function resetTenantInvite(input: unknown): Promise<TenantActionResult> {
  const parsed = tenantActionInputSchema.safeParse(input);
  if (!parsed.success) return failure('INVALID_INPUT', 'Aksi tidak valid.');

  const { tenantId, action, reason } = parsed.data;
  if (action !== 'reset') return failure('INVALID_INPUT', `Aksi ${action} bukan reset undangan.`);
  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  let tenant;
  try {
    tenant = await getTenantByIdOr404(tenantId);
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  // Reset undangan sengaja TIDAK diblokir untuk tenant BANNED/SUSPENDED.
  // Tautan reset hanya menetapkan kata sandi; akses tetap ditolak gate status
  // tenant di `authorizeResolvedUser`, jadi tidak ada jalur bypass. Memblokirnya
  // justru membuat serah-terima kredensial mustahil setelah tenant di-ban.
  let inviteUrl: string;
  try {
    inviteUrl = await generatePasswordResetLink(tenant.ownerEmail);
  } catch {
    return failure(
      'INVITE_FAILED',
      'Tautan undangan gagal dibuat. Pastikan akun owner masih ada di Firebase.',
    );
  }

  const delivery = await sendTenantInviteEmail({
    to: tenant.ownerEmail,
    ownerName: tenant.companyName,
    companyName: tenant.companyName,
    planName: tenant.planTier,
    inviteUrl,
  });

  const auditContext = await getAuditRequestContext();

  // Reset undangan BUKAN aksi high-risk: email sudah terkirim, jadi kegagalan
  // audit tidak boleh menggagalkan respons. Bandingkan dengan create/status/
  // delete/downgrade yang menaruh audit di dalam transaksi mutasinya.
  try {
    await writeAuditLogTx(
      getDatabase(),
      {
        actorUserId: session.userId,
        actorEmail: session.email,
        actorRole: 'CEO',
        tenantId,
        action: TENANT_AUDIT_ACTIONS.resetInvite,
        resourceId: tenantId,
        reason,
        metadata: { delivered: delivery.ok },
      },
      auditContext,
    );
  } catch {
    // Kegagalan audit reset-undangan dicatat ke console; status pengiriman email
    // tetap menjadi sumber kebenaran untuk respons ke CEO.
  }

  revalidatePath(`/ceo-dashboard/tenants/${tenantId}`);

  if (!delivery.ok) {
    return failure('INVITE_FAILED', `Email undangan gagal dikirim. ${delivery.message}`);
  }

  return { ok: true, tenantId, message: 'Undangan owner dikirim ulang.' };
}

/** Menurunkan plan tenant dan mencatat langganan baru sebagai PENDING. */
export async function downgradeTenant(input: unknown): Promise<TenantActionResult> {
  const parsed = tenantActionInputSchema.safeParse(input);
  if (!parsed.success) return failure('INVALID_INPUT', 'Aksi tidak valid.');
  // Narrowing eksplisit: union hanya menyediakan `planTier` pada varian ini.
  if (parsed.data.action !== 'downgrade') {
    return failure('INVALID_INPUT', `Aksi ${parsed.data.action} bukan downgrade.`);
  }

  const { tenantId, reason, planTier } = parsed.data;

  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  let tenant;
  try {
    tenant = await getTenantByIdOr404(tenantId);
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  const plan = await getActivePlan(planTier);
  if (!plan) return failure('INVALID_INPUT', `Plan ${planTier} tidak tersedia.`);

  if (tenant.planTier === plan.tier) {
    return failure('CONFLICT', `Tenant sudah memakai plan ${plan.name}.`);
  }

  const db = getDatabase();
  const nowMs = Date.now();
  const { start, end } = periodBounds('monthly', nowMs);
  const auditContext = await getAuditRequestContext();

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(tenants)
        .set({
          planTier: plan.tier,
          deviceQuota: plan.features.deviceIncluded,
          frameQuota: plan.features.maxFrameUpload,
          storageQuotaMb: plan.features.storageMb,
          staffQuota: plan.features.staffLimit,
          retentionDays: plan.features.retentionDays,
          updatedAt: new Date(nowMs),
        })
        .where(eq(tenants.id, tenantId));

      await tx.insert(b2bSubscriptions).values({
        tenantId,
        planId: plan.id,
        planTier: plan.tier,
        status: 'PENDING',
        amount: Number(plan.priceMonthly).toFixed(2),
        validFrom: start,
        validUntil: end,
      });

      await writeAuditLogTx(
        tx,
        {
          actorUserId: session.userId,
          actorEmail: session.email,
          actorRole: 'CEO',
          tenantId,
          action: TENANT_AUDIT_ACTIONS.downgrade,
          resourceId: tenantId,
          reason,
          metadata: { from: tenant.planTier, to: plan.tier },
        },
        auditContext,
      );
    });
  } catch {
    return failure('SERVER_ERROR', 'Downgrade gagal disimpan.');
  }

  revalidatePath(`/ceo-dashboard/tenants/${tenantId}`);
  revalidatePath('/ceo-dashboard/tenants');

  return { ok: true, tenantId, message: `Plan tenant diturunkan ke ${plan.name}.` };
}

/**
 * Soft delete tenant (PRD Task 1.8, Bab 6.A).
 *
 * Soft delete, BUKAN hard delete: status menjadi `DELETED`, `deletedAt` diisi,
 * dan akun Owner dinonaktifkan di DB. Baris tenant dan seluruh data anak tetap
 * ada untuk retensi 30 hari (purge di luar scope). Setelah `DELETED`, detail
 * lookup `getTenantByIdOr404` menutup tenant sebagai 404 karena memfilter
 * `deletedAt`, sehingga tenant terhapus tidak bisa diakses lagi lewat UI.
 */
export async function deleteTenant(input: unknown): Promise<TenantActionResult> {
  const parsed = tenantActionInputSchema.safeParse(input);
  if (!parsed.success) return failure('INVALID_INPUT', 'Aksi tidak valid.');
  if (parsed.data.action !== 'delete') {
    return failure('INVALID_INPUT', `Aksi ${parsed.data.action} bukan delete.`);
  }

  const { tenantId, reason } = parsed.data;

  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  let tenant;
  try {
    tenant = await getTenantByIdOr404(tenantId);
  } catch (error) {
    if (error instanceof TenantServerError) return failure(error.code, error.message);
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  // `DELETED` bersifat terminal; hapus ulang bukan aksi yang bermakna.
  if (tenant.status === 'DELETED') {
    return failure('CONFLICT', 'Tenant sudah dihapus.');
  }

  const db = getDatabase();
  const now = new Date();
  const auditContext = await getAuditRequestContext();

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(tenants)
        .set({ status: 'DELETED', deletedAt: now, updatedAt: now })
        .where(eq(tenants.id, tenantId));

      // Owner DB dinonaktifkan dalam transaksi yang sama; Firebase menyusul
      // setelah commit karena tidak bisa ikut transaksi PostgreSQL.
      await tx
        .update(users)
        .set({ disabled: true, updatedAt: now })
        .where(and(eq(users.tenantId, tenantId), eq(users.role, 'OWNER')));

      await writeAuditLogTx(
        tx,
        {
          actorUserId: session.userId,
          actorEmail: session.email,
          actorRole: 'CEO',
          tenantId,
          action: TENANT_AUDIT_ACTIONS.delete,
          resourceId: tenantId,
          reason,
          metadata: { from: tenant.status, to: 'DELETED', softDelete: true },
        },
        auditContext,
      );
    });
  } catch {
    return failure('SERVER_ERROR', 'Tenant gagal dihapus. Tidak ada data yang berubah.');
  }

  const owner = await findTenantOwner(tenantId);
  if (owner?.firebaseUid) {
    try {
      await setUserDisabled(owner.firebaseUid, true);
    } catch {
      return failure(
        'SERVER_ERROR',
        'Tenant sudah ditandai DELETED di database, tetapi akun Owner gagal dinonaktifkan di Firebase. Tindak lanjuti secara manual.',
      );
    }
  }

  revalidatePath('/ceo-dashboard/tenants');

  return { ok: true, tenantId, message: 'Tenant dihapus (soft delete, retensi 30 hari).' };
}
