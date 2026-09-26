import { and, desc, eq, sql } from 'drizzle-orm';
import { b2cPaymentConfigs, getDatabase } from '@snapbox/db';
import { checkEntitlement } from '@/lib/entitlement/entitlement-service';
import { requireOwnerTenant } from './outlet-server';
import { decryptPaymentCredential, encryptPaymentCredential } from './payment-crypto';
import { testPaymentProvider } from './payment-provider-test';
import {
  paymentSaveSchema,
  paymentTestSchema,
  type PaymentConfigRecord,
  type PaymentSettingsData,
  type PaymentTestInput,
} from './payment-contract';

function safe(row: typeof b2cPaymentConfigs.$inferSelect): PaymentConfigRecord {
  return {
    id: row.id,
    provider: row.provider,
    mode: row.mode,
    merchantId: row.merchantId,
    isPrimary: row.isPrimary,
    isActive: row.isActive,
    hasApiKey: Boolean(row.apiKeyEncrypted),
    hasSecretKey: Boolean(row.secretKeyEncrypted),
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    lastTestSuccess: row.lastTestSuccess,
  };
}

async function entitlement(tenantId: string, feature: 'paymentGatewayB2C' | 'backupGateway') {
  return checkEntitlement(tenantId, feature);
}

export async function getOwnerPaymentSettings(tenantId: string): Promise<PaymentSettingsData> {
  const [rows, gateway, backup] = await Promise.all([
    getDatabase()
      .select()
      .from(b2cPaymentConfigs)
      .where(eq(b2cPaymentConfigs.tenantId, tenantId))
      .orderBy(desc(b2cPaymentConfigs.isPrimary)),
    entitlement(tenantId, 'paymentGatewayB2C'),
    entitlement(tenantId, 'backupGateway'),
  ]);
  return { configs: rows.map(safe), canConfigure: gateway.allowed, canUseBackup: backup.allowed };
}

export async function testOwnerPaymentConnection(input: unknown) {
  const parsed = paymentTestSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      code: 'INVALID_INPUT' as const,
      message: 'Periksa kredensial gateway.',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join('.') || 'form', i.message]),
      ),
    };
  const auth = await requireOwnerTenant();
  if (!auth)
    return { ok: false as const, code: 'UNAUTHORIZED' as const, message: 'Sesi tidak berwenang.' };
  if (!(await entitlement(auth.tenantId, 'paymentGatewayB2C')).allowed)
    return {
      ok: false as const,
      code: 'FORBIDDEN' as const,
      message: 'Payment gateway tidak termasuk paket Anda.',
    };
  return providerTest(parsed.data);
}

async function providerTest(input: PaymentTestInput) {
  const result = await testPaymentProvider(input);
  return result.ok
    ? { ok: true as const, message: 'Koneksi gateway berhasil.' }
    : { ok: false as const, code: 'TEST_FAILED' as const, message: result.message };
}

export async function saveOwnerPaymentConfig(input: unknown) {
  const parsed = paymentSaveSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      code: 'INVALID_INPUT' as const,
      message: 'Periksa kembali konfigurasi gateway.',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join('.') || 'form', i.message]),
      ),
    };
  const auth = await requireOwnerTenant();
  if (!auth)
    return { ok: false as const, code: 'UNAUTHORIZED' as const, message: 'Sesi tidak berwenang.' };
  const gateway = await entitlement(auth.tenantId, 'paymentGatewayB2C');
  if (!gateway.allowed)
    return {
      ok: false as const,
      code: 'FORBIDDEN' as const,
      message: 'Payment gateway tidak termasuk paket Anda.',
    };
  if (!parsed.data.isPrimary && !(await entitlement(auth.tenantId, 'backupGateway')).allowed)
    return {
      ok: false as const,
      code: 'FORBIDDEN' as const,
      message: 'Gateway cadangan tidak termasuk paket Anda.',
    };
  try {
    const db = getDatabase();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${auth.tenantId}, 41))`);
      const [existing] = await tx
        .select()
        .from(b2cPaymentConfigs)
        .where(
          and(
            eq(b2cPaymentConfigs.tenantId, auth.tenantId),
            eq(b2cPaymentConfigs.provider, parsed.data.provider),
          ),
        )
        .limit(1);
      const apiKey =
        parsed.data.apiKey ??
        (existing?.apiKeyEncrypted ? decryptPaymentCredential(existing.apiKeyEncrypted) : null);
      const secretKey =
        parsed.data.secretKey ??
        (existing?.secretKeyEncrypted
          ? decryptPaymentCredential(existing.secretKeyEncrypted)
          : null);
      if (!apiKey || !secretKey) return { error: 'INVALID_INPUT' as const };
      if (parsed.data.provider === 'DOKU' && !parsed.data.merchantId && !existing?.merchantId)
        return { error: 'INVALID_INPUT' as const };
      const test = await providerTest({
        provider: parsed.data.provider,
        mode: parsed.data.mode,
        apiKey,
        secretKey,
        merchantId: parsed.data.merchantId ?? existing?.merchantId ?? undefined,
      });
      if (!test.ok) return { error: 'TEST_FAILED' as const, message: test.message };
      if (parsed.data.isPrimary)
        await tx
          .update(b2cPaymentConfigs)
          .set({ isPrimary: false })
          .where(
            and(
              eq(b2cPaymentConfigs.tenantId, auth.tenantId),
              eq(b2cPaymentConfigs.isActive, true),
            ),
          );
      await tx
        .insert(b2cPaymentConfigs)
        .values({
          tenantId: auth.tenantId,
          provider: parsed.data.provider,
          mode: parsed.data.mode,
          apiKeyEncrypted: encryptPaymentCredential(apiKey),
          secretKeyEncrypted: encryptPaymentCredential(secretKey),
          merchantId: parsed.data.merchantId ?? existing?.merchantId ?? null,
          isPrimary: parsed.data.isPrimary,
          isActive: parsed.data.isActive,
          lastTestedAt: new Date(),
          lastTestSuccess: true,
        })
        .onConflictDoUpdate({
          target: [b2cPaymentConfigs.tenantId, b2cPaymentConfigs.provider],
          set: {
            mode: parsed.data.mode,
            apiKeyEncrypted: encryptPaymentCredential(apiKey),
            secretKeyEncrypted: encryptPaymentCredential(secretKey),
            merchantId: parsed.data.merchantId ?? existing?.merchantId ?? null,
            isPrimary: parsed.data.isPrimary,
            isActive: parsed.data.isActive,
            lastTestedAt: new Date(),
            lastTestSuccess: true,
          },
        });
      const rows = await tx
        .select()
        .from(b2cPaymentConfigs)
        .where(eq(b2cPaymentConfigs.tenantId, auth.tenantId))
        .orderBy(desc(b2cPaymentConfigs.isPrimary));
      return { rows };
    });
    if ('error' in result)
      return result.error === 'TEST_FAILED'
        ? { ok: false as const, code: 'TEST_FAILED' as const, message: result.message }
        : {
            ok: false as const,
            code: 'INVALID_INPUT' as const,
            message: 'API key dan secret wajib diisi.',
          };
    return {
      ok: true as const,
      message: 'Konfigurasi gateway tersimpan.',
      data: result.rows.map(safe),
    };
  } catch {
    return {
      ok: false as const,
      code: 'SERVER_ERROR' as const,
      message: 'Konfigurasi gateway gagal disimpan.',
    };
  }
}
