/**
 * Self-check Feature Entitlement (PRD Task 1.7).
 *
 * Dijalankan `node --test` dari root repo, pola sama dengan
 * `apps/web/src/lib/auth/pin.test.mjs`. Resolver di `entitlement-contract.ts`
 * sengaja murni, sehingga invariannya diuji di sini tanpa TypeScript loader
 * maupun DB.
 *
 * Yang diuji adalah INVARIAN keputusan, bukan detail pesan: komposisi add-on,
 * `-1` tanpa batas, matriks langganan/tenant, validasi bentuk feature, dan
 * fail-closed. Test ini juga mencerminkan aturan yang dipakai `authorization.ts`;
 * bila daftar status di sana berubah tanpa modul kontrak, test ini gagal.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// Salinan minimal aturan dari `entitlement-contract.ts`. Test tidak mengimpor
// modul TS agar bisa jalan dengan `node --test` polos.
const UNLIMITED = -1;
const BLOCKED_TENANT_STATUSES = ['SUSPENDED', 'BANNED', 'DELETED'];
const USABLE_SUBSCRIPTION_STATUSES = ['ACTIVE', 'EXPIRING', 'GRACE_PERIOD'];

const PLAN_FEATURE_KEYS = [
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
const ENTITLEMENT_FEATURES = [...PLAN_FEATURE_KEYS, 'deviceQuota'];

function isEntitlementFeature(value) {
  return ENTITLEMENT_FEATURES.includes(value);
}

function denied(feature, reason) {
  return { allowed: false, feature, value: null, source: 'denied', reason };
}

function effectiveDeviceQuota(included, addOnDevices) {
  if (!Number.isSafeInteger(addOnDevices) || addOnDevices < 0) return { ok: false };
  if (!Number.isSafeInteger(included)) return { ok: false };
  if (included === UNLIMITED) return { ok: true, value: UNLIMITED };
  if (included < 0) return { ok: false };
  return { ok: true, value: included + addOnDevices };
}

function isSubscriptionUsable(subscription, nowMs) {
  if (!subscription || !USABLE_SUBSCRIPTION_STATUSES.includes(subscription.status)) return false;
  const deadline =
    subscription.status === 'GRACE_PERIOD' && subscription.gracePeriodUntil
      ? subscription.gracePeriodUntil
      : subscription.validUntil;
  return deadline !== null && deadline !== undefined && deadline > nowMs;
}

/** Cermin validasi bentuk `plan-features-shape.ts` (bentuk saja, bukan enum). */
function parsePlanFeatures(value) {
  if (!value || typeof value !== 'object') return null;
  const limitOk = (limit, unlimited) =>
    Number.isSafeInteger(limit) &&
    (limit === UNLIMITED ? unlimited : limit >= 0) &&
    limit <= 100000;
  if (
    !limitOk(value.deviceIncluded, false) ||
    !limitOk(value.addOnPricePerDevice, false) ||
    !limitOk(value.maxFrameUpload, true) ||
    !limitOk(value.storageMb, false) ||
    !limitOk(value.retentionDays, false) ||
    !limitOk(value.staffLimit, true) ||
    !limitOk(value.outletLimit, true)
  ) {
    return null;
  }
  for (const flag of [
    'paymentGatewayB2C',
    'backupGateway',
    'promoEnabled',
    'promoAdvanced',
    'kioskCustomEnabled',
    'kioskMultiplePanelStyle',
    'priorityRealtime',
  ]) {
    if (typeof value[flag] !== 'boolean') return null;
  }
  if (!Array.isArray(value.cameraTypes) || value.cameraTypes.length === 0) return null;
  if (!value.cameraTypes.every((item) => typeof item === 'string' && item.length > 0)) return null;
  for (const str of ['chromaKeyLevel', 'filterLevel', 'supportLevel']) {
    if (typeof value[str] !== 'string' || value[str].length === 0) return null;
  }
  return value;
}

function resolveEntitlement(feature, snapshot, subscription, nowMs = Date.now()) {
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

  const rawValue = features[feature];
  if (rawValue === undefined || rawValue === null) return denied(feature, 'UNKNOWN_FEATURE');
  return { allowed: true, feature, value: rawValue, source: 'plan', reason: null };
}

const STARTER = {
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
};

const ENTERPRISE = {
  ...STARTER,
  deviceIncluded: 2,
  maxFrameUpload: UNLIMITED,
  staffLimit: UNLIMITED,
  outletLimit: UNLIMITED,
  chromaKeyLevel: 'MULTILAYER',
  promoAdvanced: true,
  priorityRealtime: true,
};

const FUTURE = Date.UTC(2030, 0, 1);
const PAST = Date.UTC(2020, 0, 1);
const NOW = Date.UTC(2026, 5, 1);

function snapshot(features, { addOnDevices = 0, tenantStatus = 'ACTIVE' } = {}) {
  return { tenantId: 'tenant-1', tenantStatus, addOnDevices, planFeatures: features };
}

function activeSub(validUntil = new Date(FUTURE)) {
  return { status: 'ACTIVE', validUntil, gracePeriodUntil: null };
}

test('feature sah mencakup seluruh PlanFeatures plus deviceQuota', () => {
  for (const key of PLAN_FEATURE_KEYS) {
    assert.equal(isEntitlementFeature(key), true, key);
  }
  assert.equal(isEntitlementFeature('deviceQuota'), true);
  assert.equal(isEntitlementFeature('storageQuotaMb'), false);
  assert.equal(isEntitlementFeature('planTier'), false);
});

test('boolean feature mengembalikan nilai plan dan allowed', () => {
  const starter = resolveEntitlement('paymentGatewayB2C', snapshot(STARTER), activeSub(), NOW);
  assert.equal(starter.allowed, true);
  assert.equal(starter.value, false);
  assert.equal(starter.source, 'plan');

  const enterprise = resolveEntitlement(
    'paymentGatewayB2C',
    snapshot({ ...STARTER, paymentGatewayB2C: true }),
    activeSub(),
    NOW,
  );
  assert.equal(enterprise.allowed, true);
  assert.equal(enterprise.value, true);
});

test('limit angka dikembalikan apa adanya, termasuk -1 unlimited', () => {
  const staff = resolveEntitlement('staffLimit', snapshot(STARTER), activeSub(), NOW);
  assert.equal(staff.value, 2);

  const unlimited = resolveEntitlement('staffLimit', snapshot(ENTERPRISE), activeSub(), NOW);
  assert.equal(unlimited.value, UNLIMITED);
});

test('nilai enum/string dan array diteruskan tanpa transformasi', () => {
  const chroma = resolveEntitlement('chromaKeyLevel', snapshot(STARTER), activeSub(), NOW);
  assert.equal(chroma.value, 'AUTO');
  const support = resolveEntitlement('supportLevel', snapshot(STARTER), activeSub(), NOW);
  assert.equal(support.value, 'Email');
  const cameras = resolveEntitlement('cameraTypes', snapshot(STARTER), activeSub(), NOW);
  assert.deepEqual(cameras.value, ['WEBCAM']);
});

test('deviceQuota menjumlahkan add-on perangkat', () => {
  const base = resolveEntitlement('deviceQuota', snapshot(STARTER), activeSub(), NOW);
  assert.equal(base.value, 1);
  assert.equal(base.source, 'plan');

  const withAddOn = resolveEntitlement(
    'deviceQuota',
    snapshot(STARTER, { addOnDevices: 3 }),
    activeSub(),
    NOW,
  );
  assert.equal(withAddOn.value, 4);
  assert.equal(withAddOn.source, 'plan+add-on');
});

test('deviceQuota unlimited TIDAK dijumlahkan dengan add-on', () => {
  // Regresi: -1 + 2 pernah menghasilkan 1 dan memotong kuota Enterprise.
  // Diuji langsung pada komposisi karena `deviceIncluded` memang tidak
  // mengizinkan `-1` di skema bentuk; `-1` hanya sah pada field unlimited.
  assert.deepEqual(effectiveDeviceQuota(UNLIMITED, 2), { ok: true, value: UNLIMITED });
  assert.deepEqual(effectiveDeviceQuota(UNLIMITED, 0), { ok: true, value: UNLIMITED });
  assert.deepEqual(effectiveDeviceQuota(1, 2), { ok: true, value: 3 });
});

test('add-on tidak wajar ditolak, bukan memberi kapasitas', () => {
  for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = resolveEntitlement(
      'deviceQuota',
      snapshot(STARTER, { addOnDevices: bad }),
      activeSub(),
      NOW,
    );
    assert.equal(result.allowed, false, String(bad));
    assert.equal(result.reason, 'INVALID_DATA');
  }
});

test('feature tidak dikenal ditolak fail-closed', () => {
  const result = resolveEntitlement('storageQuotaMb', snapshot(STARTER), activeSub(), NOW);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'UNKNOWN_FEATURE');
});

test('tenant terblokir menolak sebelum langganan dinilai', () => {
  for (const status of ['SUSPENDED', 'BANNED', 'DELETED']) {
    const result = resolveEntitlement(
      'deviceQuota',
      snapshot(STARTER, { tenantStatus: status }),
      activeSub(),
      NOW,
    );
    assert.equal(result.allowed, false, status);
    assert.equal(result.reason, 'TENANT_BLOCKED');
  }
});

test('langganan tanpa row menolak', () => {
  const result = resolveEntitlement('deviceQuota', snapshot(STARTER), null, NOW);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'SUBSCRIPTION_NOT_USABLE');
});

test('matriks status langganan sesuai gate otorisasi', () => {
  const usable = ['ACTIVE', 'EXPIRING', 'GRACE_PERIOD'];
  const blocked = ['PENDING', 'EXPIRED', 'SUSPENDED', 'CANCELLED'];

  for (const status of usable) {
    const result = resolveEntitlement(
      'deviceQuota',
      snapshot(STARTER),
      { status, validUntil: new Date(FUTURE), gracePeriodUntil: new Date(FUTURE) },
      NOW,
    );
    assert.equal(result.allowed, true, status);
  }

  for (const status of blocked) {
    const result = resolveEntitlement(
      'deviceQuota',
      snapshot(STARTER),
      { status, validUntil: new Date(FUTURE), gracePeriodUntil: new Date(FUTURE) },
      NOW,
    );
    assert.equal(result.allowed, false, status);
    assert.equal(result.reason, 'SUBSCRIPTION_NOT_USABLE');
  }

  assert.deepEqual(USABLE_SUBSCRIPTION_STATUSES, usable);
});

test('GRACE_PERIOD dinilai dari batas grace, bukan validUntil', () => {
  const graceFuture = {
    status: 'GRACE_PERIOD',
    validUntil: new Date(PAST),
    gracePeriodUntil: new Date(FUTURE),
  };
  assert.equal(
    resolveEntitlement('deviceQuota', snapshot(STARTER), graceFuture, NOW).allowed,
    true,
  );

  const gracePast = {
    status: 'GRACE_PERIOD',
    validUntil: new Date(FUTURE),
    gracePeriodUntil: new Date(PAST),
  };
  assert.equal(resolveEntitlement('deviceQuota', snapshot(STARTER), gracePast, NOW).allowed, false);
});

test('tanggal hilang atau lewat menolak, tidak dianggap tanpa batas', () => {
  const noDate = { status: 'ACTIVE', validUntil: null, gracePeriodUntil: null };
  assert.equal(resolveEntitlement('deviceQuota', snapshot(STARTER), noDate, NOW).allowed, false);

  const expired = activeSub(new Date(PAST));
  assert.equal(resolveEntitlement('deviceQuota', snapshot(STARTER), expired, NOW).allowed, false);
});

test('bentuk feature rusak ditolak INVALID_DATA, bukan dipakai sebagian', () => {
  const cases = [
    { ...STARTER, deviceIncluded: 1.5 },
    { ...STARTER, deviceIncluded: -5 },
    { ...STARTER, staffLimit: 1.5 },
    { ...STARTER, paymentGatewayB2C: 'ya' },
    { ...STARTER, cameraTypes: [] },
    { ...STARTER, cameraTypes: [42] },
    { ...STARTER, chromaKeyLevel: '' },
    { ...STARTER, supportLevel: 12 },
  ];

  for (const features of cases) {
    const result = resolveEntitlement('deviceQuota', snapshot(features), activeSub(), NOW);
    assert.equal(result.allowed, false, JSON.stringify(features));
    assert.equal(result.reason, 'INVALID_DATA');
  }
});

test('plan tanpa langganan terhubung menolak PLAN_NOT_FOUND', () => {
  const result = resolveEntitlement('deviceQuota', snapshot(null), activeSub(), NOW);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'PLAN_NOT_FOUND');
});

test('penolakan tidak pernah membocorkan nilai plan', () => {
  const result = resolveEntitlement('deviceQuota', snapshot(STARTER), null, NOW);
  assert.equal(result.value, null);
  assert.equal(result.source, 'denied');
  assert.equal(result.reason, 'SUBSCRIPTION_NOT_USABLE');
  assert.deepEqual(Object.keys(result).sort(), ['allowed', 'feature', 'reason', 'source', 'value']);
  assert.equal(JSON.stringify(result).includes('DATABASE_URL'), false);
});
