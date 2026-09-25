/**
 * Server action pengaturan global (PRD Task 1.9).
 *
 * Urutan tetap, sama seperti modul tenant (Task 1.4), plan (Task 1.5), dan
 * invoice (Task 1.6):
 * 1. otorisasi CEO dari sesi + DB (`requireCeo`),
 * 2. validasi input dengan skema kontrak (input browser tidak dipercaya),
 * 3. validasi placeholder template,
 * 4. upsert satu baris `platform_settings`,
 * 5. audit `platform_setting.update`,
 * 6. `revalidatePath('/ceo-dashboard/settings')`.
 *
 * Action ini TIDAK pernah menerima atau menyimpan secret. Key di luar allowlist
 * ditolak skema, sehingga tidak ada jalur menulis setting arbitrer.
 */
'use server';

import { revalidatePath } from 'next/cache';

import {
  collectSettingsIssues,
  normalizeSettingUpdate,
  settingsUpdateInputSchema,
  type SettingsActionResult,
} from '@/lib/ceo-dashboard/settings-contract';
import { persistSetting, requireCeo, TenantServerError } from '@/lib/ceo-dashboard/settings-server';
import { getAuditRequestContext, writeAuditLogTx } from '@/lib/ceo-dashboard/tenant-server';
import { getDatabase } from '@snapbox/db';

function failure(
  code: Extract<SettingsActionResult, { ok: false }>['code'],
  message: string,
  fieldErrors?: Record<string, string>,
): SettingsActionResult {
  return { ok: false, code, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

/**
 * Menyimpan satu pengaturan global.
 *
 * Satu action per key (bukan satu form besar) supaya scope mutasi jelas dan
 * satu field yang gagal tidak membatalkan field lain yang sudah sah.
 */
export async function updateSetting(input: unknown): Promise<SettingsActionResult> {
  const parsed = settingsUpdateInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.') || 'value';
      fieldErrors[path] ??= issue.message;
    }
    return failure('INVALID_INPUT', 'Periksa kembali nilai yang diisi.', fieldErrors);
  }

  const update = normalizeSettingUpdate(parsed.data);

  // Validasi placeholder template sebelum menyentuh DB. `collectSettingsIssues`
  // menjalankan skema nilai key ini, jadi hasilnya sudah tervalidasi ulang.
  const issues = collectSettingsIssues(update.key, update.value);
  if (issues.length > 0) {
    return failure('INVALID_INPUT', issues.join(' '), {
      value: 'Gunakan hanya placeholder yang terdaftar.',
    });
  }

  let session;
  try {
    session = await requireCeo();
  } catch (error) {
    if (error instanceof TenantServerError) {
      return failure(
        error.code === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'SERVER_ERROR',
        error.message,
      );
    }
    return failure('SERVER_ERROR', 'Aksi tidak dapat diproses.');
  }

  const auditContext = await getAuditRequestContext();

  try {
    await getDatabase().transaction(async (tx) => {
      await persistSetting(update.key, update.value, session.userId, tx);
      // Audit fail-closed di dalam transaksi: setting tidak pernah tersimpan
      // tanpa jejak (PRD Bab 8.8).
      await writeAuditLogTx(
        tx,
        {
          actorUserId: session.userId,
          actorEmail: session.email,
          actorRole: 'CEO',
          tenantId: null,
          action: 'platform_setting.update',
          resourceType: 'platform_setting',
          resourceId: update.key,
          // Metadata hanya key + tipe nilai. Isi template tidak diduplikasi ke
          // audit, dan tidak ada secret yang pernah melewati jalur ini.
          metadata: { key: update.key, valueType: typeof update.value },
        },
        auditContext,
      );
    });
  } catch {
    return failure('SERVER_ERROR', 'Pengaturan gagal disimpan. Coba lagi.');
  }

  revalidatePath('/ceo-dashboard/settings');

  return { ok: true, key: update.key, message: 'Pengaturan tersimpan.' };
}
