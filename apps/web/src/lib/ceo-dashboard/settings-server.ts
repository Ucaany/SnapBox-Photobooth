/**
 * Utilitas server pengaturan global (PRD Task 1.9).
 *
 * Semua akses DB dan keputusan bentuk nilai untuk modul settings ada di sini
 * agar server action tetap tipis. Modul ini HANYA untuk server: ia menarik
 * `@snapbox/db` dan `next/headers` (lewat `requireCeo`).
 *
 * Otorisasi diulang ke DB setiap aksi (ADR-004); snapshot cookie bisa basi.
 * DILARANG membaca/menulis secret (SMTP, API key, service role) di sini.
 */
import { eq, inArray } from 'drizzle-orm';

import { getDatabase, platformSettings } from '@snapbox/db';
import type { AuditWriter } from './tenant-server';

import {
  SETTINGS_DEFAULTS,
  SETTING_KEYS,
  type EmailTemplateKey,
  type EmailTemplateValue,
  type FeatureFlagKey,
  type SettingKey,
  type SettingsSnapshot,
  settingValueSchemas,
  emailTemplateValueSchema,
  featureFlagSchema,
} from './settings-contract';
import { TenantServerError, requireCeo } from './tenant-server';

/** Validasi nilai template dari DB; baris rusak jatuh ke default, bukan crash. */
function parseTemplate(key: EmailTemplateKey, raw: unknown): EmailTemplateValue {
  const parsed = emailTemplateValueSchema.safeParse(raw);
  return parsed.success ? parsed.data : SETTINGS_DEFAULTS.templates[key];
}

/** Validasi flag dari DB; nilai non-boolean diperlakukan sebagai default. */
function parseFlag(key: FeatureFlagKey, raw: unknown): boolean {
  const parsed = featureFlagSchema.safeParse(raw);
  return parsed.success ? parsed.data : SETTINGS_DEFAULTS.flags[key];
}

/**
 * Membaca seluruh pengaturan global sebagai snapshot tervalidasi.
 *
 * Baris yang tidak ada memakai default aman dari kontrak; ini membuat halaman
 * tetap bisa dibuka pada environment yang belum di-seed tanpa menampilkan nilai
 * permisif. Tidak pernah mengembalikan secret.
 */
export async function readSettingsSnapshot(): Promise<SettingsSnapshot> {
  const rows = await getDatabase()
    .select({ key: platformSettings.key, value: platformSettings.value })
    .from(platformSettings);

  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const whatsapp = byKey.get(SETTING_KEYS.salesWhatsappNumber);
  const replyTo = byKey.get(SETTING_KEYS.emailDefaultReplyTo);

  return {
    whatsappNumber: settingValueSchemas.sales_whatsapp_number.safeParse(whatsapp).success
      ? settingValueSchemas.sales_whatsapp_number.parse(whatsapp)
      : SETTINGS_DEFAULTS.whatsappNumber,
    emailReplyTo: settingValueSchemas.email_default_reply_to.safeParse(replyTo).success
      ? settingValueSchemas.email_default_reply_to.parse(replyTo)
      : SETTINGS_DEFAULTS.emailReplyTo,
    templates: {
      [SETTING_KEYS.templateTenantInvite]: parseTemplate(
        SETTING_KEYS.templateTenantInvite,
        byKey.get(SETTING_KEYS.templateTenantInvite),
      ),
      [SETTING_KEYS.templateInvoiceB2b]: parseTemplate(
        SETTING_KEYS.templateInvoiceB2b,
        byKey.get(SETTING_KEYS.templateInvoiceB2b),
      ),
      [SETTING_KEYS.templateSubscriptionExpiring]: parseTemplate(
        SETTING_KEYS.templateSubscriptionExpiring,
        byKey.get(SETTING_KEYS.templateSubscriptionExpiring),
      ),
    },
    flags: {
      [SETTING_KEYS.flagKioskThemeCustomizer]: parseFlag(
        SETTING_KEYS.flagKioskThemeCustomizer,
        byKey.get(SETTING_KEYS.flagKioskThemeCustomizer),
      ),
      [SETTING_KEYS.flagAdvancedPromoBatch]: parseFlag(
        SETTING_KEYS.flagAdvancedPromoBatch,
        byKey.get(SETTING_KEYS.flagAdvancedPromoBatch),
      ),
      [SETTING_KEYS.flagWebDeviceConsole]: parseFlag(
        SETTING_KEYS.flagWebDeviceConsole,
        byKey.get(SETTING_KEYS.flagWebDeviceConsole),
      ),
    },
  };
}

/**
 * Menyimpan satu setting secara atomik via upsert pada `key`.
 *
 * Nilai sudah divalidasi kontrak sebelum dipanggil; fungsi ini tidak menerima
 * key di luar allowlist karena tipe `SettingKey` sudah membatasinya.
 *
 * `client` opsional supaya action bisa menyertakan upsert ini di transaksi yang
 * sama dengan penulisan audit (fail-closed). Tanpa argumen, koneksi default
 * dipakai. Tipe `AuditWriter` (Pick<Database, 'insert'>) sengaja dipakai agar
 * transaksi Drizzle maupun koneksi biasa sama-sama diterima.
 */
export async function persistSetting(
  key: SettingKey,
  value: unknown,
  actorUserId: string,
  client?: AuditWriter,
): Promise<void> {
  const db = client ?? getDatabase();
  const now = new Date();

  await db
    .insert(platformSettings)
    .values({ key, value, updatedByUserId: actorUserId, updatedAt: now })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value, updatedByUserId: actorUserId, updatedAt: now },
    });
}

/** Membaca nilai beberapa key sekaligus; dipakai test/administrasi. */
export async function readSettingValues(
  keys: readonly SettingKey[],
): Promise<Map<string, unknown>> {
  const rows = await getDatabase()
    .select({ key: platformSettings.key, value: platformSettings.value })
    .from(platformSettings)
    .where(inArray(platformSettings.key, [...keys]));

  return new Map(rows.map((row) => [row.key, row.value]));
}

/** Menghapus satu setting agar kembali ke default. */
export async function deleteSetting(key: SettingKey): Promise<void> {
  await getDatabase().delete(platformSettings).where(eq(platformSettings.key, key));
}

export { requireCeo, TenantServerError };
