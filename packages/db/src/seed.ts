/**
 * Seed data dasar SnapBox.
 *
 * Untuk saat ini hanya tabel `plans`, karena isinya adalah sumber kebenaran
 * harga dan batas fitur (PRD Bab 5.3) yang dibutuhkan `EntitlementService`.
 * Data dummy tenant/booth/transaksi masuk di Fase 1 dan 2.
 *
 * Idempotent: aman dijalankan berulang, baris yang ada di-update, bukan diduplikasi.
 *
 * Jalankan: `pnpm --filter @snapbox/db seed`
 */
import { closeDatabase, getDatabase } from './client';
import { plans } from './schema';
import type { PlanFeatures } from './schema';

interface PlanSeed {
  tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  name: string;
  priceMonthly: string;
  priceYearly: string;
  features: PlanFeatures;
}

/** Angka mengikuti matriks entitlement PRD Bab 5.3. `-1` berarti tanpa batas. */
const PLAN_SEEDS: readonly PlanSeed[] = [
  {
    tier: 'STARTER',
    name: 'Starter',
    priceMonthly: '100000',
    priceYearly: '1000000',
    features: {
      deviceIncluded: 1,
      addOnPricePerDevice: 99000,
      paymentGatewayB2C: false,
      backupGateway: false,
      cameraTypes: ['WEBCAM'],
      maxFrameUpload: 3,
      storageMb: 2048,
      retentionDays: 30,
      promoEnabled: false,
      promoAdvanced: false,
      kioskCustomEnabled: false,
      kioskMultiplePanelStyle: false,
      staffLimit: 2,
      outletLimit: 1,
      chromaKeyLevel: 'AUTO',
      filterLevel: 'BASIC',
      supportLevel: 'Email',
      priorityRealtime: false,
    },
  },
  {
    tier: 'GROWTH',
    name: 'Growth',
    priceMonthly: '180000',
    priceYearly: '1800000',
    features: {
      deviceIncluded: 1,
      addOnPricePerDevice: 99000,
      paymentGatewayB2C: true,
      backupGateway: true,
      cameraTypes: ['WEBCAM', 'DSLR'],
      maxFrameUpload: 15,
      storageMb: 20480,
      retentionDays: 90,
      promoEnabled: true,
      promoAdvanced: false,
      kioskCustomEnabled: true,
      kioskMultiplePanelStyle: false,
      staffLimit: 10,
      outletLimit: 5,
      chromaKeyLevel: 'ADVANCED',
      filterLevel: 'ADJUST',
      supportLevel: 'Email + WhatsApp',
      priorityRealtime: true,
    },
  },
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    priceMonthly: '250000',
    priceYearly: '2500000',
    features: {
      deviceIncluded: 2,
      addOnPricePerDevice: 99000,
      paymentGatewayB2C: true,
      backupGateway: true,
      cameraTypes: ['WEBCAM', 'DSLR'],
      maxFrameUpload: -1,
      storageMb: 102400,
      retentionDays: 365,
      promoEnabled: true,
      promoAdvanced: true,
      kioskCustomEnabled: true,
      kioskMultiplePanelStyle: true,
      staffLimit: -1,
      outletLimit: -1,
      chromaKeyLevel: 'MULTILAYER',
      filterLevel: 'CUSTOM_LUT',
      supportLevel: 'Priority + Dedicated',
      priorityRealtime: true,
    },
  },
];

async function main(): Promise<void> {
  const db = getDatabase();

  for (const plan of PLAN_SEEDS) {
    await db
      .insert(plans)
      .values(plan)
      .onConflictDoUpdate({
        target: plans.tier,
        set: {
          name: plan.name,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          features: plan.features,
          updatedAt: new Date(),
        },
      });
  }

  console.log(`Seed selesai: ${PLAN_SEEDS.length} plan tersinkron (Starter, Growth, Enterprise).`);
}

try {
  await main();
} catch (error) {
  console.error('Seed gagal:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
