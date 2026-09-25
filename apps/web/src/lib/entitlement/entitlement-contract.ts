/**
 * Kontrak Feature Entitlement (PRD Bab 5.3, Task 1.7).
 *
 * Ini SATU-SATUNYA tempat batas plan diterjemahkan menjadi keputusan fitur.
 * Pemanggil DILARANG membandingkan nama tier (mis. menyamakan `planTier` dengan
 * salah satu nilai STARTER/GROWTH/ENTERPRISE) atau menyalin limit dari
 * `plans.features` sendiri; semuanya lewat `checkEntitlement`.
 *
 * Modul ini sengaja murni: tanpa `next/*`, tanpa Drizzle, tanpa runtime Node.
 * Resolver di sini bisa diuji `node --test` polos, dan modul server yang
 * membaca DB hanya menyuplai data ke fungsi murni ini.
 *
 * Tipe `PlanFeatures` berasal dari `@snapbox/db` sebagai kontrak canonical dan
 * diimpor type-only supaya bundle klien tidak tertarik runtime Drizzle.
 */
import type { PlanFeatures } from '@snapbox/db';
import type { SubscriptionStatus } from '@snapbox/shared/domain';
import { parsePlanFeatures } from './plan-features-shape';

/**
 * Feature yang bisa dicek.
 *
 * Semua key `PlanFeatures` bisa diminta apa adanya agar limit baru tidak perlu
 * didaftarkan ulang di sini. `deviceQuota` adalah feature TURUNAN: nilainya
 * `deviceIncluded` + add-on perangkat tenant. Turunan ini hanya ada selama
 * add-on perangkat disimpan di kolom `tenants.add_on_devices`; saat add-on
 * generik ditambahkan, komposisinya pindah ke tabel itu tanpa mengubah API.
 */
export type EntitlementFeature = keyof PlanFeatures | 'deviceQuota';

/** `-1` berarti tanpa batas; nilai kanonik sama dengan editor plan. */
export const UNLIMITED = -1;

/**
 * Nilai entitlement yang dikembalikan.
 *
 * Boolean untuk gate fitur, number untuk limit (termasuk `-1`), string untuk
 * level/enum/support. Caller yang mengecek limit membandingkan angka; caller
 * fitur boolean memakai `allowed`.
 */
export type EntitlementValue = boolean | number | string | readonly string[];

/** Dari mana nilai berasal; dipakai UI untuk menjelaskan limit ke Owner. */
export type EntitlementSource = 'plan' | 'plan+add-on' | 'denied';

/**
 * Alasan penolakan yang aman ditampilkan.
 *
 * Tidak ada detail DB, tidak ada keberadaan tenant. `DENIED` sengaja umum
 * supaya tenant yang tidak ada tidak bisa dibedakan dari tenant yang ada.
 */
export type EntitlementDenialReason =
  | 'UNKNOWN_FEATURE'
  | 'TENANT_NOT_FOUND'
  | 'PLAN_NOT_FOUND'
  | 'SUBSCRIPTION_NOT_USABLE'
  | 'TENANT_BLOCKED'
  | 'LOOKUP_FAILED'
  | 'INVALID_DATA';

/** Hasil evaluasi entitlement. Discriminated union, tidak pernah throw. */
export type EntitlementResult =
  | {
      readonly allowed: true;
      readonly feature: EntitlementFeature;
      readonly value: EntitlementValue;
      readonly source: Exclude<EntitlementSource, 'denied'>;
      readonly reason: null;
    }
  | {
      readonly allowed: false;
      readonly feature: EntitlementFeature;
      readonly value: null;
      readonly source: 'denied';
      readonly reason: EntitlementDenialReason;
    };

/**
 * Snapshot minimal yang dibutuhkan resolver.
 *
 * Semua field berasal dari DB dan sudah tenant-scoped. `addOnDevices`
 * merepresentasikan add-on perangkat yang benar-benar aktif untuk tenant.
 */
export interface EntitlementSnapshot {
  readonly tenantId: string;
  readonly tenantStatus: string;
  readonly addOnDevices: number;
  readonly planFeatures: PlanFeatures | null;
}

/**
 * Aturan langganan yang dianggap memberi entitas.
 *
 * Sama dengan gate otorisasi (`authorization.ts`): `EXPIRING` dan
 * `GRACE_PERIOD` masih masa berlaku sah, `PENDING` belum dibayar. Satu-satunya
 * perbedaan tempat: resolver menerima status + deadline yang SUDAH dinormalkan,
 * sehingga tidak ada dua daftar status yang bisa menyimpang.
 */
export interface EntitlementSubscription {
  readonly status: SubscriptionStatus;
  readonly validUntil: Date | null;
  readonly gracePeriodUntil: Date | null;
}

export function isSubscriptionUsable(
  subscription: EntitlementSubscription | null,
  nowMs: number = Date.now(),
): boolean {
  if (!subscription || !USABLE_SUBSCRIPTION_STATUSES.includes(subscription.status)) return false;
  const deadline =
    subscription.status === 'GRACE_PERIOD' && subscription.gracePeriodUntil
      ? subscription.gracePeriodUntil
      : subscription.validUntil;
  return deadline !== null && deadline.getTime() > nowMs;
}

/** Status tenant yang memblokir entitlement, sejalan dengan gate login. */
export const BLOCKED_TENANT_STATUSES: readonly string[] = ['SUSPENDED', 'BANNED', 'DELETED'];

/** Status langganan yang masih memberi akses; selaras `authorization.ts`. */
export const USABLE_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'ACTIVE',
  'EXPIRING',
  'GRACE_PERIOD',
];

/** Semua key kanonik `PlanFeatures`; dipakai validasi feature dan `formatAll`. */
export const PLAN_FEATURE_KEYS: readonly (keyof PlanFeatures)[] = [
  'deviceIncluded',
  'addOnPricePerDevice',
  'paymentGatewayB2C',
  'backupGateway',
  'cameraTypes',
  'maxFrameUpload',
  'storageMb',
  'retentionDays',
  'promoEnabled',
  'promoAdvanced',
  'kioskCustomEnabled',
  'kioskMultiplePanelStyle',
  'staffLimit',
  'outletLimit',
  'chromaKeyLevel',
  'filterLevel',
  'supportLevel',
  'priorityRealtime',
];

/** Semua feature yang sah untuk `checkEntitlement`. */
export const ENTITLEMENT_FEATURES: readonly EntitlementFeature[] = [
  ...PLAN_FEATURE_KEYS,
  'deviceQuota',
];

/** Apakah key yang diterima benar-benar feature yang sah. */
export function isEntitlementFeature(value: string): value is EntitlementFeature {
  return (ENTITLEMENT_FEATURES as readonly string[]).includes(value);
}

function denied(feature: EntitlementFeature, reason: EntitlementDenialReason): EntitlementResult {
  return { allowed: false, feature, value: null, source: 'denied', reason };
}

/**
 * Menghitung batas device efektif.
 *
 * `-1` berarti tanpa batas dan TIDAK dijumlahkan: `-1 + 2` akan menghasilkan
 * `1`, yaitu bug yang memotong kuota Enterprise. Add-on negatif atau bukan
 * bilangan bulat juga ditolak karena data itu tidak masuk akal, dan lebih baik
 * fail-closed daripada memberi kapasitas.
 */
export function effectiveDeviceQuota(
  included: number,
  addOnDevices: number,
): { ok: true; value: number } | { ok: false } {
  if (!Number.isSafeInteger(addOnDevices) || addOnDevices < 0) return { ok: false };
  if (!Number.isSafeInteger(included)) return { ok: false };
  if (included === UNLIMITED) return { ok: true, value: UNLIMITED };
  if (included < 0) return { ok: false };
  return { ok: true, value: included + addOnDevices };
}

/**
 * Mengevaluasi entitlement dari data yang SUDUH diambil server.
 *
 * Fungsi ini murni: seluruh keputusan berhenti di sini, jadi perilakunya bisa
 * diuji tanpa DB, dan service server tidak boleh menambah gate kedua yang
 * berbeda. Urutan pemeriksaan penting: tenant dulu, lalu langganan, lalu plan.
 */
export function resolveEntitlement(
  feature: EntitlementFeature,
  snapshot: EntitlementSnapshot,
  subscription: EntitlementSubscription | null,
  nowMs: number = Date.now(),
): EntitlementResult {
  if (!isEntitlementFeature(feature)) return denied(feature, 'UNKNOWN_FEATURE');

  if (BLOCKED_TENANT_STATUSES.includes(snapshot.tenantStatus)) {
    return denied(feature, 'TENANT_BLOCKED');
  }

  if (!isSubscriptionUsable(subscription, nowMs)) {
    return denied(feature, 'SUBSCRIPTION_NOT_USABLE');
  }

  if (!snapshot.planFeatures) return denied(feature, 'PLAN_NOT_FOUND');
  const features = parsePlanFeatures(snapshot.planFeatures);
  if (!features) return denied(feature, 'INVALID_DATA');

  if (feature === 'deviceQuota') {
    const quota = effectiveDeviceQuota(features.deviceIncluded, snapshot.addOnDevices);
    if (!quota.ok) return denied(feature, 'INVALID_DATA');
    return {
      allowed: true,
      feature,
      value: quota.value,
      source: snapshot.addOnDevices > 0 ? 'plan+add-on' : 'plan',
      reason: null,
    };
  }

  const rawValue: EntitlementValue | undefined = features[feature];

  if (rawValue === undefined || rawValue === null) return denied(feature, 'UNKNOWN_FEATURE');

  // `cameraTypes` adalah satu-satunya feature array; tipe `EntitlementValue`
  // sudah mencakup `readonly string[]` sehingga tidak perlu cast.
  if (Array.isArray(rawValue) && !rawValue.every((item) => typeof item === 'string')) {
    return denied(feature, 'INVALID_DATA');
  }

  return { allowed: true, feature, value: rawValue, source: 'plan', reason: null };
}

/**
 * Memeriksa apakah `value` (limit angka) masih muat untuk `current` pemakaian.
 *
 * Dipakai caller yang meng-enforce kuota. `-1` selalu muat. Nilai tidak wajar
 * ditolak.
 */
export function withinLimit(result: EntitlementResult, current: number, requested = 1): boolean {
  if (!result.allowed) return false;
  if (typeof result.value !== 'number') return false;
  if (!Number.isSafeInteger(current) || current < 0) return false;
  if (!Number.isSafeInteger(requested) || requested < 0) return false;
  if (result.value === UNLIMITED) return true;
  return current + requested <= result.value;
}
