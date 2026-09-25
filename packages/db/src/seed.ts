/**
 * Seed data dasar SnapBox (PRD Task 1.12).
 *
 * Dua kelompok data:
 * 1. `plans` - sumber kebenaran harga dan batas fitur (PRD Bab 5.3) yang
 *    dibutuhkan `EntitlementService`.
 * 2. Tiga tenant contoh (PRD Bab 9) beserta owner, langganan aktif, dan satu
 *    booth default - supaya dashboard CEO/Owner tidak kosong tanpa provisioning
 *    nyata lewat wizard.
 *
 * Yang sengaja TIDAK di-seed:
 * - `activity_logs`: tabel immutable dengan aktor user nyata (PRD Bab 8.8);
 *   audit palsu merusak arti audit trail.
 * - Kolom secret/kredensial: hash PIN, pairing code, fingerprint perangkat,
 *   dan kredensial gateway TIDAK PERNAH diisi. Uji invariant di
 *   `packages/db/seed-invariants.test.mjs` menegakkan ini.
 * - UID Firebase nyata: `users.firebase_uid` seed memakai awalan `seed:` yang
 *   jelas placeholder dan TIDAK bisa dipakai login (tidak ada akun Firebase-nya).
 *
 * Idempotent: aman dijalankan berulang. `plans` di-upsert by `tier`; tenant,
 * owner, dan langganan dicari dulu berdasarkan kunci alaminya (email tenant /
 * email owner / pasangan tenant+plan) sebelum insert, sehingga tidak ada
 * duplikat pada seed kedua.
 *
 * Jalankan: `pnpm --filter @snapbox/db seed`
 */
import { and, eq, isNull } from 'drizzle-orm';

import { closeDatabase, getDatabase } from './client';
// Import langsung dari modul skema (bukan barrel `./index`) supaya `and`/`eq`
// dari `drizzle-orm` tidak bentrok dengan re-export `./schema` -> `drizzle-orm`.
import { b2bSubscriptions, booths, plans, tenants, users } from './schema';
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

/**
 * Tenant contoh dari PRD Bab 9 (baris 950-956).
 *
 * `slug` hanya dipakai untuk `firebase_uid` placeholder (`seed:<slug>`) dan
 * tidak pernah menjadi identifier di database. Email memakai domain contoh PRD
 * apa adanya; itu bukan kotak surat yang dijangkau dan tidak dipakai login.
 * Ketiga tier diwakili supaya `EntitlementService` punya data uji lintas plan.
 */
interface TenantSeed {
  slug: string;
  companyName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  address: string | null;
  planTier: PlanSeed['tier'];
}

const TENANT_SEEDS: readonly TenantSeed[] = [
  {
    slug: 'pixelbooth',
    companyName: 'Pixelbooth Indonesia',
    ownerName: 'Budi Santoso',
    ownerEmail: 'budi@pixelbooth.id',
    ownerPhone: '628110001001',
    address: 'Jakarta Pusat',
    planTier: 'GROWTH',
  },
  {
    slug: 'snapmoment',
    companyName: 'Snap Moment Studio',
    ownerName: 'Sari Wulandari',
    ownerEmail: 'sari@snapmoment.id',
    ownerPhone: '628110001002',
    address: 'Bandung',
    planTier: 'ENTERPRISE',
  },
  {
    slug: 'klikklik',
    companyName: 'Klik Klik Photobooth',
    ownerName: 'Dedi Kurniawan',
    ownerEmail: 'dedi@klikklik.id',
    ownerPhone: '628110001003',
    address: 'Surabaya',
    planTier: 'STARTER',
  },
];

/** Penanda baris seed pada kolom `tenants.notes` agar mudah dikenali operator. */
const SEED_NOTE = 'Seed Task 1.12 (data contoh)';

/** Selesai satu tahun dari `now`; langganan seed tidak boleh langsung kedaluwarsa. */
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function seedPlans(): Promise<Map<PlanSeed['tier'], { id: string; priceMonthly: string }>> {
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

  const rows = await db
    .select({ id: plans.id, tier: plans.tier, priceMonthly: plans.priceMonthly })
    .from(plans);
  const byTier = new Map(
    rows.map((row) => [row.tier, { id: row.id, priceMonthly: row.priceMonthly }]),
  );

  // Guard eksplisit: tanpa ini, tier yang hilang menghasilkan `undefined` dan
  // error baru muncul jauh di dalam loop tenant sebagai "cannot read id".
  for (const plan of PLAN_SEEDS) {
    if (!byTier.has(plan.tier)) {
      throw new Error(`Plan ${plan.tier} tidak ditemukan setelah upsert.`);
    }
  }

  console.log(`Seed plan: ${PLAN_SEEDS.length} tier tersinkron (Starter, Growth, Enterprise).`);
  return byTier;
}

async function seedTenants(
  planByTier: Map<PlanSeed['tier'], { id: string; priceMonthly: string }>,
): Promise<void> {
  const db = getDatabase();
  const now = new Date();
  const validUntil = new Date(now.getTime() + ONE_YEAR_MS);

  for (const seed of TENANT_SEEDS) {
    const plan = planByTier.get(seed.planTier);
    if (!plan)
      throw new Error(`Plan ${seed.planTier} tidak tersedia untuk tenant ${seed.companyName}.`);

    const planRow = PLAN_SEEDS.find((row) => row.tier === seed.planTier);
    if (!planRow) throw new Error(`Definisi plan ${seed.planTier} tidak ditemukan di PLAN_SEEDS.`);
    const features = planRow.features;

    await db.transaction(async (tx) => {
      // 1. Tenant: kunci idempotensi = `owner_email` DAN penanda `notes` seed.
      //    Penanda WAJIB ikut dicocokkan: email contoh PRD bisa saja sudah
      //    dipakai tenant NYATA hasil wizard (`createTenant` menolak email
      //    duplikat, jadi tenant itu pasti berbeda baris). Tanpa penanda, seed
      //    akan menulis ulang nama/plan/kuota tenant nyata tersebut.
      const [existingTenant] = await tx
        .select({ id: tenants.id, notes: tenants.notes })
        .from(tenants)
        .where(eq(tenants.ownerEmail, seed.ownerEmail))
        .limit(1);

      let tenantId: string;
      const tenantValues = {
        companyName: seed.companyName,
        ownerEmail: seed.ownerEmail,
        ownerPhone: seed.ownerPhone,
        address: seed.address,
        planTier: seed.planTier,
        status: 'ACTIVE' as const,
        deviceQuota: features.deviceIncluded,
        frameQuota: features.maxFrameUpload,
        storageQuotaMb: features.storageMb,
        staffQuota: features.staffLimit,
        retentionDays: features.retentionDays,
        notes: SEED_NOTE,
        updatedAt: now,
      };

      if (existingTenant && existingTenant.notes !== SEED_NOTE) {
        // Tenant nyata memakai email contoh ini. Melewati seed lebih benar
        // daripada menimpa data produksi demi data demo.
        console.warn(
          `Seed tenant: lewati ${seed.companyName} - email ${seed.ownerEmail} sudah dipakai tenant nyata (${existingTenant.id}).`,
        );
        return;
      }

      if (existingTenant) {
        await tx.update(tenants).set(tenantValues).where(eq(tenants.id, existingTenant.id));
        tenantId = existingTenant.id;
      } else {
        const [inserted] = await tx
          .insert(tenants)
          .values({ ...tenantValues, createdAt: now })
          .returning({ id: tenants.id });
        if (!inserted)
          throw new Error(`Insert tenant ${seed.companyName} tidak mengembalikan baris.`);
        tenantId = inserted.id;
      }

      // 2. Owner: `firebase_uid` placeholder `seed:<slug>`, BUKAN UID Firebase.
      //    Baris dicocokkan hanya bila `firebase_uid`-nya placeholder seed;
      //    owner nyata dengan email contoh tidak boleh diubah rolenya.
      const [existingUser] = await tx
        .select({ id: users.id, firebaseUid: users.firebaseUid })
        .from(users)
        .where(eq(users.email, seed.ownerEmail))
        .limit(1);

      const seedFirebaseUid = `seed:${seed.slug}`;
      const userValues = {
        fullName: seed.ownerName,
        phone: seed.ownerPhone,
        role: 'OWNER' as const,
        tenantId,
        disabled: false,
        updatedAt: now,
      };

      if (existingUser && existingUser.firebaseUid !== seedFirebaseUid) {
        console.warn(
          `Seed owner: lewati ${seed.ownerEmail} - email sudah dipakai user nyata (${existingUser.id}).`,
        );
      } else if (existingUser) {
        await tx
          .update(users)
          .set({ ...userValues, firebaseUid: seedFirebaseUid })
          .where(eq(users.id, existingUser.id));
      } else {
        await tx.insert(users).values({
          ...userValues,
          firebaseUid: seedFirebaseUid,
          email: seed.ownerEmail,
          createdAt: now,
        });
      }

      // 3. Langganan aktif: baris seed harus lolos gate `isSubscriptionUsable`
      //    (status ACTIVE + validUntil di masa depan). TANPA `pakasir_invoice_id`
      //    karena ini bukan invoice; pada data nyata status ACTIVE hanya datang
      //    dari webhook Pakasir terverifikasi.
      //    Pencarian baris existing DIBATASI ke baris tanpa invoice Pakasir,
      //    supaya langganan nyata (mis. PENDING menunggu webhook, atau ACTIVE
      //    dengan invoice) tidak pernah ditimpa nilai seed.
      const [existingSub] = await tx
        .select({ id: b2bSubscriptions.id })
        .from(b2bSubscriptions)
        .where(
          and(
            eq(b2bSubscriptions.tenantId, tenantId),
            eq(b2bSubscriptions.planId, plan.id),
            isNull(b2bSubscriptions.pakasirInvoiceId),
          ),
        )
        .limit(1);

      const subValues = {
        tenantId,
        planId: plan.id,
        planTier: seed.planTier,
        status: 'ACTIVE' as const,
        amount: plan.priceMonthly,
        validFrom: now,
        validUntil,
        gracePeriodUntil: null,
        paidAt: now,
        updatedAt: now,
      };

      if (existingSub) {
        await tx
          .update(b2bSubscriptions)
          .set(subValues)
          .where(eq(b2bSubscriptions.id, existingSub.id));
      } else {
        await tx.insert(b2bSubscriptions).values({ ...subValues, createdAt: now });
      }

      // 4. Satu booth default per tenant supaya dashboard Owner tidak kosong.
      //    `status = UNPAIRED` dan TANPA fingerprint/pairing/PIN: booth seed
      //    tidak boleh bisa dipasangkan atau dipakai login.
      const [existingBooth] = await tx
        .select({ id: booths.id })
        .from(booths)
        .where(
          and(
            eq(booths.tenantId, tenantId),
            eq(booths.name, 'Booth 1'),
            isNull(booths.deviceFingerprint),
          ),
        )
        .limit(1);

      if (!existingBooth) {
        await tx.insert(booths).values({
          tenantId,
          name: 'Booth 1',
          locationTag: seed.address,
          status: 'UNPAIRED',
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    console.log(`Seed tenant: ${seed.companyName} (${seed.planTier}) siap.`);
  }
}

async function main(): Promise<void> {
  const planByTier = await seedPlans();
  await seedTenants(planByTier);

  console.log(
    `Seed selesai: ${PLAN_SEEDS.length} plan + ${TENANT_SEEDS.length} tenant contoh. Catatan: user seed dengan firebase_uid "seed:*" bukan akun Firebase dan tidak bisa login.`,
  );
}

try {
  await main();
} catch (error) {
  console.error('Seed gagal:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
