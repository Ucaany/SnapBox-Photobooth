/**
 * EntitlementService (PRD Task 1.7).
 *
 * Satu-satunya pintu keputusan "tenant ini boleh fitur X?". Service ini:
 *   1. membaca tenant + plan canonical + langganan terbaru, tenant-scoped;
 *   2. menyerahkan keputusan ke `resolveEntitlement` yang murni;
 *   3. mengembalikan hasil bertipe, TIDAK PERNAH throw untuk kasus lookup.
 *
 * Modul ini HANYA server: ia menarik `@snapbox/db` (postgres). Komponen klien
 * dilarang mengimpornya; kalau butuh tipe, impor `entitlement-contract` saja.
 *
 * Konsekuensi desain: setiap kegagalan (tenant hilang, plan hilang, DB error)
 * menjadi `allowed: false`. Tidak ada fallback ke nama tier, snapshot kuota
 * tenant, atau default permisif, karena itu jalur kebocoran kapasitas.
 */
import { desc, eq } from 'drizzle-orm';

import { getDatabase, b2bSubscriptions, plans, tenants } from '@snapbox/db';

import {
  resolveEntitlement,
  type EntitlementFeature,
  type EntitlementResult,
  type EntitlementSnapshot,
  type EntitlementSubscription,
} from './entitlement-contract';

/** Alasan kegagalan lookup; dipetakan ke kode entitlement yang aman. */
export type EntitlementLookupFailure = 'NOT_FOUND' | 'LOOKUP_FAILED';

/** Snapshot lengkap tenant untuk satu request; dipakai banyak cek sekaligus. */
export interface EntitlementContext {
  readonly snapshot: EntitlementSnapshot;
  readonly subscription: EntitlementSubscription | null;
}

/**
 * Mengambil snapshot entitlement tenant.
 *
 * Tiga query kecil yang semuanya `WHERE` scoped:
 *   - `tenants`: add-on perangkat + status blokir;
 *   - `plans`: join lewat `b2b_subscriptions.planId` supaya feature yang dipakai
 *     adalah plan yang benar-benar terikat pada langganan, bukan `tenants.planTier`
 *     (tier bisa sudah berubah sebelum langganan diperbarui);
 *   - `b2b_subscriptions`: baris terbaru untuk deadline grace/validUntil.
 *
 * Mengembalikan `null` bila tenant atau plan tidak ada; error lain dilempar ke
 * pemanggil supaya `checkEntitlement` bisa memetakannya ke fail-closed.
 */
export async function loadEntitlementContext(tenantId: string): Promise<EntitlementContext | null> {
  const db = getDatabase();

  const [tenantRow] = await db
    .select({
      id: tenants.id,
      status: tenants.status,
      addOnDevices: tenants.addOnDevices,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenantRow) return null;

  const [subscriptionRow] = await db
    .select({
      status: b2bSubscriptions.status,
      validUntil: b2bSubscriptions.validUntil,
      gracePeriodUntil: b2bSubscriptions.gracePeriodUntil,
      planFeatures: plans.features,
    })
    .from(b2bSubscriptions)
    .innerJoin(plans, eq(b2bSubscriptions.planId, plans.id))
    .where(eq(b2bSubscriptions.tenantId, tenantId))
    .orderBy(desc(b2bSubscriptions.createdAt))
    .limit(1);

  if (!subscriptionRow) {
    return {
      snapshot: {
        tenantId: tenantRow.id,
        tenantStatus: tenantRow.status,
        addOnDevices: tenantRow.addOnDevices,
        planFeatures: null,
      },
      subscription: null,
    };
  }

  return {
    snapshot: {
      tenantId: tenantRow.id,
      tenantStatus: tenantRow.status,
      addOnDevices: tenantRow.addOnDevices,
      planFeatures: subscriptionRow.planFeatures,
    },
    subscription: {
      status: subscriptionRow.status,
      validUntil: subscriptionRow.validUntil,
      gracePeriodUntil: subscriptionRow.gracePeriodUntil,
    },
  };
}

/**
 * Memeriksa satu feature untuk satu tenant.
 *
 * Kontrak: selalu mengembalikan `EntitlementResult`; kegagalan lookup menjadi
 * `allowed: false` dengan alasan aman. Pemanggil yang butuh membedakan "tidak
 * ada" dari "error" dapat memakai `checkEntitlementOrFail`.
 *
 * @param tenantId Id tenant; WAJIB berasal dari sesi/resource server, bukan body klien.
 * @param feature Feature entitlement yang dicek.
 * @param nowMs Waktu sekarang, dapat diganti untuk test.
 */
export async function checkEntitlement(
  tenantId: string,
  feature: EntitlementFeature,
  nowMs: number = Date.now(),
): Promise<EntitlementResult> {
  try {
    const context = await loadEntitlementContext(tenantId);
    if (!context) {
      return {
        allowed: false,
        feature,
        value: null,
        source: 'denied',
        reason: 'TENANT_NOT_FOUND',
      };
    }

    return resolveEntitlement(feature, context.snapshot, context.subscription, nowMs);
  } catch {
    // Detail error tidak pernah bocor ke hasil; log server ditangani Sentry.
    return {
      allowed: false,
      feature,
      value: null,
      source: 'denied',
      reason: 'LOOKUP_FAILED',
    };
  }
}

/**
 * Varian yang membedakan kegagalan lookup dari penolakan entitlement.
 *
 * Dipakai alur server yang perlu menampilkan "tenant tidak ditemukan" (404)
 * berbeda dari "fitur tidak termasuk plan" (403), tanpa mengekspos error DB.
 */
export async function checkEntitlementOrFail(
  tenantId: string,
  feature: EntitlementFeature,
  nowMs: number = Date.now(),
): Promise<EntitlementResult | { failure: EntitlementLookupFailure }> {
  try {
    const context = await loadEntitlementContext(tenantId);
    if (!context) return { failure: 'NOT_FOUND' };
    return resolveEntitlement(feature, context.snapshot, context.subscription, nowMs);
  } catch {
    return { failure: 'LOOKUP_FAILED' };
  }
}

/**
 * Mengevaluasi banyak feature dari satu snapshot.
 *
 * Satu query set untuk seluruh halaman detail; menghindari N+1 saat UI perlu
 * beberapa limit sekaligus. Hasil selalu berukuran sama dengan `features` yang
 * diminta (feature tidak sah pun mengembalikan penolakan, bukan dihilangkan).
 */
export async function checkEntitlements(
  tenantId: string,
  features: readonly EntitlementFeature[],
  nowMs: number = Date.now(),
): Promise<readonly EntitlementResult[]> {
  let context: EntitlementContext | null = null;
  let lookupFailed = false;

  try {
    context = await loadEntitlementContext(tenantId);
  } catch {
    lookupFailed = true;
  }

  return features.map((feature) => {
    if (lookupFailed) {
      return {
        allowed: false,
        feature,
        value: null,
        source: 'denied',
        reason: 'LOOKUP_FAILED',
      } as const;
    }
    if (!context) {
      return {
        allowed: false,
        feature,
        value: null,
        source: 'denied',
        reason: 'TENANT_NOT_FOUND',
      } as const;
    }
    return resolveEntitlement(feature, context.snapshot, context.subscription, nowMs);
  });
}
