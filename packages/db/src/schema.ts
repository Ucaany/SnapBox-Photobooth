/**
 * Skema database SnapBox (PRD Bab 10.12) untuk Supabase PostgreSQL + Drizzle ORM.
 *
 * Aturan yang mengikat file ini:
 * 1. Nilai enum TIDAK ditulis ulang di sini. Semua `pgEnum` diturunkan dari
 *    konstanta di `@snapbox/shared` agar wire (API/realtime) dan storage tidak
 *    pernah menyimpang.
 * 2. Setiap tabel yang dimiliki tenant memuat `tenant_id`. RLS diaktifkan lewat
 *    migrasi terpisah sebagai lapisan kedua setelah otorisasi service layer
 *    (ADR-004). Cross-tenant access WAJIB dipetakan ke 404.
 * 3. Migrasi dihasilkan dari file ini (`pnpm --filter @snapbox/db generate`) dan
 *    tinggal di `packages/db/migrations`, terpisah dari kode aplikasi.
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  BOOTH_STATUSES,
  CAMERA_STATUSES,
  GATEWAY_MODES,
  GATEWAY_PROVIDERS,
  KIOSK_PANEL_STYLES,
  NOTIFICATION_TYPES,
  ORIENTATIONS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PLAN_TIERS,
  PROMO_TYPES,
  SUBSCRIPTION_STATUSES,
  TENANT_STATUSES,
  USER_ROLES,
} from '@snapbox/shared';

// ============ KOLOM KUSTOM ============

/**
 * Kolom `bytea` untuk kredensial gateway terenkripsi (ADR-003).
 *
 * Drizzle 0.45 belum mengekspor builder `bytea`, jadi tipe Postgres aslinya
 * didefinisikan di sini. Nilai di driver adalah `Uint8Array`; pemanggil
 * bertanggung jawab mengisi hasil AES-256-GCM (nonce + ciphertext + tag).
 */
export const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return 'bytea';
  },
});

// ============ ENUMS ============

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const tenantStatusEnum = pgEnum('tenant_status', TENANT_STATUSES);
export const planTierEnum = pgEnum('plan_tier', PLAN_TIERS);
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);
export const boothStatusEnum = pgEnum('booth_status', BOOTH_STATUSES);
export const paymentMethodEnum = pgEnum('payment_method', PAYMENT_METHODS);
export const paymentStatusEnum = pgEnum('payment_status', PAYMENT_STATUSES);
export const promoTypeEnum = pgEnum('promo_type', PROMO_TYPES);
export const gatewayProviderEnum = pgEnum('gateway_provider', GATEWAY_PROVIDERS);
export const gatewayModeEnum = pgEnum('gateway_mode', GATEWAY_MODES);
export const notificationTypeEnum = pgEnum('notification_type', NOTIFICATION_TYPES);
export const kioskPanelStyleEnum = pgEnum('kiosk_panel_style', KIOSK_PANEL_STYLES);
export const orientationEnum = pgEnum('orientation', ORIENTATIONS);
export const cameraStatusEnum = pgEnum('camera_status', CAMERA_STATUSES);

// ============ USERS ============

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firebaseUid: varchar('firebase_uid', { length: 128 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    role: userRoleEnum('role').notNull(),
    tenantId: uuid('tenant_id'),
    parentTenantId: uuid('parent_tenant_id'),
    disabled: boolean('disabled').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('users_email_idx').on(t.email),
    index('users_role_idx').on(t.role),
    index('users_tenant_idx').on(t.tenantId),
  ],
);

// ============ TENANTS ============

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyName: varchar('company_name', { length: 200 }).notNull(),
    ownerEmail: varchar('owner_email', { length: 255 }).notNull(),
    ownerPhone: varchar('owner_phone', { length: 20 }),
    address: text('address'),
    logoUrl: text('logo_url'),
    planTier: planTierEnum('plan_tier').notNull().default('STARTER'),
    status: tenantStatusEnum('status').notNull().default('ACTIVE'),
    deviceQuota: integer('device_quota').notNull().default(1),
    addOnDevices: integer('add_on_devices').notNull().default(0),
    frameQuota: integer('frame_quota').notNull().default(3),
    storageQuotaMb: integer('storage_quota_mb').notNull().default(2048),
    staffQuota: integer('staff_quota').notNull().default(2),
    retentionDays: integer('retention_days').notNull().default(30),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('tenants_status_idx').on(t.status), index('tenants_plan_idx').on(t.planTier)],
);

// ============ PLANS ============

/**
 * Kontrak Feature Entitlement (PRD Bab 5.3). Satu-satunya sumber batas plan;
 * `EntitlementService` membacanya dari sini, DILARANG membandingkan
 * `plan === 'GROWTH'` di tempat lain (PRD Bab 11, Task 1.7).
 */
export interface PlanFeatures {
  deviceIncluded: number;
  addOnPricePerDevice: number;
  paymentGatewayB2C: boolean;
  backupGateway: boolean;
  cameraTypes: string[];
  maxFrameUpload: number;
  storageMb: number;
  retentionDays: number;
  promoEnabled: boolean;
  promoAdvanced: boolean;
  kioskCustomEnabled: boolean;
  kioskMultiplePanelStyle: boolean;
  staffLimit: number;
  outletLimit: number;
  chromaKeyLevel: 'AUTO' | 'ADVANCED' | 'MULTILAYER';
  filterLevel: 'BASIC' | 'ADJUST' | 'CUSTOM_LUT';
  supportLevel: string;
  priorityRealtime: boolean;
}

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  tier: planTierEnum('tier').notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  priceMonthly: numeric('price_monthly', { precision: 12, scale: 2 }).notNull(),
  priceYearly: numeric('price_yearly', { precision: 12, scale: 2 }),
  features: jsonb('features').$type<PlanFeatures>().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ B2B SUBSCRIPTIONS ============

export const b2bSubscriptions = pgTable(
  'b2b_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id),
    planTier: planTierEnum('plan_tier').notNull(),
    status: subscriptionStatusEnum('status').notNull().default('PENDING'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    gracePeriodUntil: timestamp('grace_period_until', { withTimezone: true }),
    pakasirInvoiceId: varchar('pakasir_invoice_id', { length: 128 }).unique(),
    pakasirPaymentUrl: text('pakasir_payment_url'),
    pakasirTransactionId: varchar('pakasir_transaction_id', { length: 128 }).unique(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('b2b_subs_tenant_idx').on(t.tenantId),
    index('b2b_subs_status_idx').on(t.status),
    index('b2b_subs_expiry_idx').on(t.validUntil),
  ],
);

// ============ OUTLETS ============

export const outlets = pgTable(
  'outlets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    address: text('address'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    picName: varchar('pic_name', { length: 150 }),
    picPhone: varchar('pic_phone', { length: 20 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('outlets_tenant_idx').on(t.tenantId)],
);

// ============ BOOTHS ============

export const booths = pgTable(
  'booths',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id').references(() => outlets.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 150 }).notNull(),
    locationTag: varchar('location_tag', { length: 150 }),
    status: boothStatusEnum('status').notNull().default('UNPAIRED'),
    pairingCode: varchar('pairing_code', { length: 12 }),
    pairingCodeHash: varchar('pairing_code_hash', { length: 128 }),
    pairingCodeExpiresAt: timestamp('pairing_code_expires_at', { withTimezone: true }),
    deviceFingerprint: varchar('device_fingerprint', { length: 128 }).unique(),
    paperCount: integer('paper_count').notNull().default(0),
    paperCapacity: integer('paper_capacity').notNull().default(200),
    paperAlertThresholdPct: integer('paper_alert_threshold_pct').notNull().default(20),
    maintenanceMode: boolean('maintenance_mode').notNull().default(false),
    pinLockEnabled: boolean('pin_lock_enabled').notNull().default(false),
    pinLockPinHash: varchar('pin_lock_pin_hash', { length: 128 }),
    operatorPinHash: varchar('operator_pin_hash', { length: 128 }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    cameraId: varchar('camera_id', { length: 120 }),
    cameraType: varchar('camera_type', { length: 40 }),
    printerName: varchar('printer_name', { length: 200 }),
    printerPaperSize: varchar('printer_paper_size', { length: 40 }).default('4x6'),
    printerPort: varchar('printer_port', { length: 60 }),
    printerVendor: varchar('printer_vendor', { length: 60 }),
    printerModel: varchar('printer_model', { length: 120 }),
    displayOrientation: orientationEnum('display_orientation').notNull().default('LANDSCAPE'),
    appVersion: varchar('app_version', { length: 40 }),
    platform: varchar('platform', { length: 40 }),
    configVersion: integer('config_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('booths_tenant_idx').on(t.tenantId),
    index('booths_status_idx').on(t.status),
    index('booths_outlet_idx').on(t.outletId),
    uniqueIndex('booths_fp_idx').on(t.deviceFingerprint),
  ],
);

// ============ DEVICES ============

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boothId: uuid('booth_id')
      .notNull()
      .references(() => booths.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    deviceFingerprint: varchar('device_fingerprint', { length: 128 }).notNull().unique(),
    appVersion: varchar('app_version', { length: 40 }),
    platform: varchar('platform', { length: 40 }),
    osVersion: varchar('os_version', { length: 120 }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    uptimeSeconds: integer('uptime_seconds'),
    sessionJwtHash: varchar('session_jwt_hash', { length: 128 }),
    isRevoked: boolean('is_revoked').notNull().default(false),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('devices_booth_idx').on(t.boothId), index('devices_tenant_idx').on(t.tenantId)],
);

// ============ PAIRING TOKENS ============

/**
 * Server hanya menyimpan `code_hash`, tidak pernah kode mentah (ADR-001).
 * Satu baris = satu sesi pairing, single-use, tenant + booth scoped.
 */
export const pairingTokens = pgTable(
  'pairing_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    boothId: uuid('booth_id')
      .notNull()
      .references(() => booths.id, { onDelete: 'cascade' }),
    codeHash: varchar('code_hash', { length: 128 }).notNull(),
    manualCode: varchar('manual_code', { length: 12 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    used: boolean('used').notNull().default(false),
    usedAt: timestamp('used_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    createdByUserId: uuid('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('pair_code_idx').on(t.codeHash), index('pair_booth_idx').on(t.boothId)],
);

// ============ DEVICE CALIBRATIONS ============

export const deviceCalibrations = pgTable(
  'device_calibrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceFingerprint: varchar('device_fingerprint', { length: 128 }).notNull(),
    cameraId: varchar('camera_id', { length: 120 }).notNull(),
    mirrorX: boolean('mirror_x').notNull().default(false),
    mirrorY: boolean('mirror_y').notNull().default(false),
    rotationDeg: integer('rotation_deg').notNull().default(0),
    zoomLevel: numeric('zoom_level', { precision: 4, scale: 2 }).notNull().default('1.00'),
    offsetX: integer('offset_x').notNull().default(0),
    offsetY: integer('offset_y').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('calib_fp_cam_idx').on(t.deviceFingerprint, t.cameraId)],
);

// ============ FRAMES ============

export const frames = pgTable(
  'frames',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    storageUrl: text('storage_url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    layer: varchar('layer', { length: 20 }).notNull().default('FRONT'),
    transparentColorHex: varchar('transparent_color_hex', { length: 9 }),
    toleranceDelta: integer('tolerance_delta').notNull().default(15),
    width: integer('width'),
    height: integer('height'),
    fileSizeBytes: integer('file_size_bytes'),
    isActive: boolean('is_active').notNull().default(false),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('frames_tenant_idx').on(t.tenantId), index('frames_active_idx').on(t.isActive)],
);

// ============ FRAME VERSIONS ============

export const frameVersions = pgTable('frame_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  frameId: uuid('frame_id')
    .notNull()
    .references(() => frames.id, { onDelete: 'cascade' }),
  storageUrl: text('storage_url').notNull(),
  transparentColorHex: varchar('transparent_color_hex', { length: 9 }),
  toleranceDelta: integer('tolerance_delta').notNull().default(15),
  versionNumber: integer('version_number').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ BOOTH FRAME ASSIGNMENTS ============

export const boothFrames = pgTable(
  'booth_frames',
  {
    boothId: uuid('booth_id')
      .notNull()
      .references(() => booths.id, { onDelete: 'cascade' }),
    frameId: uuid('frame_id')
      .notNull()
      .references(() => frames.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.boothId, t.frameId] })],
);

// ============ TEMPLATES ============

export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  layoutType: varchar('layout_type', { length: 40 }).notNull(),
  poseGrid: jsonb('pose_grid').$type<{ rows: number; cols: number; padding: number }>(),
  printDimensions: varchar('print_dimensions', { length: 40 }),
  aspectRatio: varchar('aspect_ratio', { length: 20 }),
  background: varchar('background', { length: 20 }),
  previewUrl: text('preview_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ PACKAGES ============

export const packages = pgTable('packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  boothId: uuid('booth_id').references(() => booths.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  poseCount: integer('pose_count').notNull().default(1),
  printCount: integer('print_count').notNull().default(1),
  /** -1 berarti tanpa batas (Starter maksimum 3, lihat PRD Bab 6.D). */
  retakeLimit: integer('retake_limit').notNull().default(-1),
  includeGif: boolean('include_gif').notNull().default(true),
  printSize: varchar('print_size', { length: 20 }).notNull().default('4x6'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ KIOSK THEMES ============

export const kioskThemes = pgTable('kiosk_themes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  boothId: uuid('booth_id').references(() => booths.id, { onDelete: 'cascade' }),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 9 }).notNull().default('#FFDD00'),
  accentColor: varchar('accent_color', { length: 9 }).notNull().default('#8B5CF6'),
  backgroundColor: varchar('background_color', { length: 9 }).notNull().default('#FFFEF5'),
  fontFamily: varchar('font_family', { length: 80 }).notNull().default('Space Grotesk'),
  welcomeText: text('welcome_text'),
  ctaText: varchar('cta_text', { length: 120 }).default('SENTUH UNTUK MULAI ✨'),
  attractModeType: varchar('attract_mode_type', { length: 20 }).notNull().default('VIDEO'),
  attractVideoUrl: text('attract_video_url'),
  attractSlideshowEnabled: boolean('attract_slideshow_enabled').notNull().default(true),
  panelStyle: kioskPanelStyleEnum('panel_style').notNull().default('CLASSIC'),
  orientation: orientationEnum('orientation').notNull().default('LANDSCAPE'),
  prePaymentGuide: jsonb('pre_payment_guide').$type<{
    steps: { title: string; desc: string; icon: string }[];
  }>(),
  version: integer('version').notNull().default(1),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ KIOSK THEME VERSIONS ============

export const kioskThemeVersions = pgTable('kiosk_theme_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  themeId: uuid('theme_id')
    .notNull()
    .references(() => kioskThemes.id, { onDelete: 'cascade' }),
  snapshot: jsonb('snapshot').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ PROMOS ============

export const promos = pgTable(
  'promos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    isGlobal: boolean('is_global').notNull().default(false),
    code: varchar('code', { length: 20 }).notNull(),
    name: varchar('name', { length: 150 }),
    type: promoTypeEnum('type').notNull(),
    value: numeric('value', { precision: 12, scale: 2 }).notNull(),
    minPurchase: numeric('min_purchase', { precision: 12, scale: 2 }).notNull().default('0'),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
    quotaTotal: integer('quota_total'),
    quotaUsed: integer('quota_used').notNull().default(0),
    quotaPerCustomer: integer('quota_per_customer').notNull().default(1),
    boothScope: jsonb('booth_scope').$type<string[]>(),
    packageScope: jsonb('package_scope').$type<string[]>(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Kode voucher case-insensitive (PRD Bab 6.F): expression index `lower(code)`
    // adalah jaminan sebenarnya. `uniqueIndex(...).on(t.code)` biasa akan
    // mengizinkan `PROMO2026` dan `promo2026` hidup berdampingan.
    uniqueIndex('promos_code_lower_idx').on(sql`lower(${t.code})`),
    index('promos_tenant_idx').on(t.tenantId),
  ],
);

// ============ PROMO REDEMPTIONS ============

export const promoRedemptions = pgTable(
  'promo_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    promoId: uuid('promo_id')
      .notNull()
      .references(() => promos.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),
    transactionId: uuid('transaction_id'),
    customerEmail: varchar('customer_email', { length: 255 }),
    discountApplied: numeric('discount_applied', { precision: 12, scale: 2 }).notNull(),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('redemption_promo_idx').on(t.promoId),
    index('redemption_customer_idx').on(t.customerEmail),
  ],
);

// ============ B2C PAYMENT CONFIGS ============

/**
 * Kredensial gateway B2C tersimpan sebagai `bytea` hasil AES-256-GCM (ADR-003).
 * Plaintext hanya ada di memori server saat create payment, tidak pernah dibaca klien.
 */
export const b2cPaymentConfigs = pgTable(
  'b2c_payment_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    provider: gatewayProviderEnum('provider').notNull(),
    mode: gatewayModeEnum('mode').notNull().default('SANDBOX'),
    apiKeyEncrypted: bytea('api_key_encrypted'),
    secretKeyEncrypted: bytea('secret_key_encrypted'),
    merchantId: varchar('merchant_id', { length: 120 }),
    isPrimary: boolean('is_primary').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    lastTestSuccess: boolean('last_test_success'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('b2c_provider_tenant_idx').on(t.tenantId, t.provider)],
);

// ============ TRANSACTIONS ============

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trxCode: varchar('trx_code', { length: 40 }).notNull().unique(),
    boothId: uuid('booth_id')
      .notNull()
      .references(() => booths.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').references(() => devices.id),
    packageId: uuid('package_id').references(() => packages.id),
    packageName: varchar('package_name', { length: 100 }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    finalAmount: numeric('final_amount', { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('PENDING'),
    gatewayProvider: gatewayProviderEnum('gateway_provider'),
    gatewayTransactionId: varchar('gateway_transaction_id', { length: 200 }).unique(),
    gatewayPaymentUrl: text('gateway_payment_url'),
    gatewayQrString: text('gateway_qr_string'),
    gatewayExpiresAt: timestamp('gateway_expires_at', { withTimezone: true }),
    voucherCode: varchar('voucher_code', { length: 20 }),
    customerEmail: varchar('customer_email', { length: 255 }),
    customerConsentShowcase: boolean('customer_consent_showcase').notNull().default(false),
    filterApplied: varchar('filter_applied', { length: 60 }),
    poseCount: integer('pose_count').notNull().default(1),
    retakeUsed: integer('retake_used').notNull().default(0),
    rawPhotoUrl: text('raw_photo_url'),
    framedPhotoUrl: text('framed_photo_url'),
    gifUrl: text('gif_url'),
    softCopyToken: varchar('soft_copy_token', { length: 64 }).unique(),
    softCopyTokenExpiresAt: timestamp('soft_copy_token_expires_at', { withTimezone: true }),
    softCopyTokenUsed: boolean('soft_copy_token_used').notNull().default(false),
    printed: boolean('printed').notNull().default(false),
    printerError: text('printer_error'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    printedAt: timestamp('printed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('trx_booth_idx').on(t.boothId),
    index('trx_tenant_idx').on(t.tenantId),
    index('trx_status_idx').on(t.paymentStatus),
    index('trx_created_idx').on(t.createdAt),
    uniqueIndex('trx_token_idx').on(t.softCopyToken),
    uniqueIndex('trx_gateway_idx').on(t.gatewayTransactionId),
  ],
);

// ============ ACTIVITY LOGS (immutable) ============

/**
 * Audit trail. Baris tidak boleh di-update atau di-delete; retensi 5 tahun
 * (PRD Bab 8.10). DILARANG menulis password, secret, API key, atau token ke
 * kolom `metadata`.
 */
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id'),
    actorEmail: varchar('actor_email', { length: 255 }),
    actorRole: userRoleEnum('actor_role'),
    tenantId: uuid('tenant_id'),
    boothId: uuid('booth_id'),
    deviceId: uuid('device_id'),
    action: varchar('action', { length: 80 }).notNull(),
    resourceType: varchar('resource_type', { length: 60 }),
    resourceId: varchar('resource_id', { length: 80 }),
    reason: text('reason'),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 60 }),
    userAgent: text('user_agent'),
    requestId: varchar('request_id', { length: 80 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('log_actor_idx').on(t.actorUserId),
    index('log_tenant_idx').on(t.tenantId),
    index('log_action_idx').on(t.action),
    index('log_created_idx').on(t.createdAt),
  ],
);

// ============ NOTIFICATIONS ============

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    boothId: uuid('booth_id'),
    type: notificationTypeEnum('type').notNull(),
    severity: varchar('severity', { length: 20 }).notNull().default('INFO'),
    title: varchar('title', { length: 200 }).notNull(),
    message: text('message').notNull(),
    metadata: jsonb('metadata'),
    isRead: boolean('is_read').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notif_user_idx').on(t.userId),
    index('notif_tenant_idx').on(t.tenantId),
    index('notif_read_idx').on(t.isRead),
  ],
);

// ============ BROADCASTS ============

export const broadcasts = pgTable('broadcasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message').notNull(),
  targetTenantIds: jsonb('target_tenant_ids').$type<string[]>(),
  targetAll: boolean('target_all').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ PAPER LOGS ============

export const paperLogs = pgTable(
  'paper_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boothId: uuid('booth_id')
      .notNull()
      .references(() => booths.id, { onDelete: 'cascade' }),
    oldCount: integer('old_count').notNull(),
    newCount: integer('new_count').notNull(),
    delta: integer('delta').notNull(),
    reason: varchar('reason', { length: 60 }).notNull(),
    updatedByUserId: uuid('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('paper_booth_idx').on(t.boothId)],
);

// ============ WEBHOOK EVENTS (idempotency) ============

/**
 * Unique `(provider, provider_event_id)` adalah mekanisme idempotensi webhook
 * (PRD Bab 6.V). Duplikat ditolak DB, handler mengembalikan 200 tanpa update.
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 40 }).notNull(),
    providerEventId: varchar('provider_event_id', { length: 200 }).notNull(),
    eventType: varchar('event_type', { length: 80 }),
    payload: jsonb('payload').notNull(),
    signatureValid: boolean('signature_valid').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('wh_event_uniq_idx').on(t.provider, t.providerEventId)],
);

// ============ WEBHOOK FAILURES (dead-letter) ============

export const webhookFailures = pgTable('webhook_failures', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 40 }).notNull(),
  payload: jsonb('payload').notNull(),
  errorMessage: text('error_message'),
  retriedCount: integer('retried_count').notNull().default(0),
  lastRetriedAt: timestamp('last_retried_at', { withTimezone: true }),
  resolved: boolean('resolved').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ DEVICE LOGS ============

export const deviceLogs = pgTable(
  'device_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }),
    boothId: uuid('booth_id'),
    tenantId: uuid('tenant_id'),
    level: varchar('level', { length: 20 }).notNull(),
    service: varchar('service', { length: 60 }),
    event: varchar('event', { length: 120 }),
    errorCode: varchar('error_code', { length: 80 }),
    message: text('message'),
    metadata: jsonb('metadata'),
    sessionId: uuid('session_id'),
    requestId: varchar('request_id', { length: 80 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('devlog_device_idx').on(t.deviceId),
    index('devlog_booth_idx').on(t.boothId),
    index('devlog_created_idx').on(t.createdAt),
  ],
);

// ============ CAMERA COMPATIBILITY ============

/** Registry 145+ kamera; status di-update admin, halaman `/kamera` membaca tabel ini (ADR-009). */
export const cameraCompatibility = pgTable(
  'camera_compatibility',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brand: varchar('brand', { length: 40 }).notNull(),
    model: varchar('model', { length: 120 }).notNull(),
    family: varchar('family', { length: 80 }),
    sdk: varchar('sdk', { length: 80 }),
    sdkVersion: varchar('sdk_version', { length: 40 }),
    connection: varchar('connection', { length: 40 }),
    remoteCapture: boolean('remote_capture').notNull().default(false),
    liveView: boolean('live_view').notNull().default(false),
    recommended: boolean('recommended').notNull().default(false),
    minimumFirmware: varchar('minimum_firmware', { length: 40 }),
    notes: text('notes'),
    knownIssues: text('known_issues'),
    status: cameraStatusEnum('status').notNull().default('EXPERIMENTAL'),
    supportedSince: timestamp('supported_since', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cam_brand_model_idx').on(t.brand, t.model),
    index('cam_status_idx').on(t.status),
  ],
);

// ============ SESSIONS (state machine kiosk) ============

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id').references(() => transactions.id, {
      onDelete: 'cascade',
    }),
    boothId: uuid('booth_id').notNull(),
    tenantId: uuid('tenant_id').notNull(),
    deviceId: uuid('device_id'),
    state: varchar('state', { length: 40 }).notNull(),
    actor: varchar('actor', { length: 40 }),
    enterAt: timestamp('enter_at', { withTimezone: true }).notNull().defaultNow(),
    exitAt: timestamp('exit_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    retryCount: integer('retry_count').notNull().default(0),
    errorCode: varchar('error_code', { length: 80 }),
    metadata: jsonb('metadata'),
  },
  (t) => [
    index('session_trx_idx').on(t.transactionId),
    index('session_booth_idx').on(t.boothId),
    index('session_state_idx').on(t.state),
  ],
);

// ============ CUSTOMERS ============

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 20 }),
    name: varchar('name', { length: 150 }),
    totalPhotos: integer('total_photos').notNull().default(0),
    totalSpent: numeric('total_spent', { precision: 12, scale: 2 }).notNull().default('0'),
    lastVisitAt: timestamp('last_visit_at', { withTimezone: true }),
    consentShowcase: boolean('consent_showcase').notNull().default(false),
    consentMarketing: boolean('consent_marketing').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customer_tenant_email_idx').on(t.tenantId, t.email)],
);

// ============ DOWNLOAD TOKENS ============

export const downloadTokens = pgTable('download_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: varchar('token', { length: 64 }).notNull().unique(),
  transactionId: uuid('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: boolean('used').notNull().default(false),
  usedAt: timestamp('used_at', { withTimezone: true }),
  ipAddress: varchar('ip_address', { length: 60 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ PLATFORM SETTINGS ============

/**
 * Pengaturan global platform (PRD Task 1.9).
 *
 * Key/value bertipe: `key` adalah allowlist kode kanonik yang didefinisikan di
 * `apps/web/src/lib/ceo-dashboard/settings-contract.ts`. `value` menyimpan
 * bentuk JSON sesuai jenis key (string nomor WhatsApp, email, objek template,
 * boolean flag). Unique pada `key` memastikan satu baris kanonik per setting.
 *
 * DILARANG menyimpan SMTP, API key, service-role, atau secret apa pun di sini
 * (PRD Bab 8.2). Secret tetap di env/secret manager; tabel ini hanya nilai
 * operasional yang memang boleh dibaca UI.
 */
export const platformSettings = pgTable(
  'platform_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 120 }).notNull().unique(),
    value: jsonb('value').$type<unknown>().notNull(),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('platform_settings_key_idx').on(t.key)],
);

// ============ PLATFORM TELEMETRY (PRD Task 1.11) ============

export const securityEvents = pgTable(
  'security_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventType: varchar('event_type', { length: 40 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull().default('INFO'),
    source: varchar('source', { length: 80 }).notNull(),
    route: varchar('route', { length: 160 }),
    subjectFingerprint: varchar('subject_fingerprint', { length: 128 }),
    sourceFingerprint: varchar('source_fingerprint', { length: 128 }),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    requestId: varchar('request_id', { length: 80 }),
    providerEventId: varchar('provider_event_id', { length: 200 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('security_events_type_created_idx').on(t.eventType, t.createdAt),
    index('security_events_severity_idx').on(t.severity),
    // Match Supabase's partial unique index: internal events may omit provider IDs.
    uniqueIndex('security_events_provider_event_idx')
      .on(t.source, t.providerEventId)
      .where(sql`${t.providerEventId} is not null`),
  ],
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ipHash: varchar('ip_hash', { length: 128 }),
    userAgent: varchar('user_agent', { length: 200 }),
  },
  (t) => [index('auth_sessions_active_idx').on(t.userId, t.revokedAt, t.expiresAt)],
);

export const systemHealthChecks = pgTable(
  'system_health_checks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    checkKey: varchar('check_key', { length: 60 }).notNull().unique(),
    component: varchar('component', { length: 80 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    latencyMs: integer('latency_ms'),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
  },
  (t) => [
    index('health_observed_idx').on(t.observedAt),
    index('health_component_idx').on(t.component),
  ],
);

// ============ RELATIONS ============

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  booths: many(booths),
  outlets: many(outlets),
  frames: many(frames),
  transactions: many(transactions),
  subscriptions: many(b2bSubscriptions),
}));

export const boothsRelations = relations(booths, ({ one, many }) => ({
  tenant: one(tenants, { fields: [booths.tenantId], references: [tenants.id] }),
  outlet: one(outlets, { fields: [booths.outletId], references: [outlets.id] }),
  packages: many(packages),
  transactions: many(transactions),
  frames: many(boothFrames),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  booth: one(booths, { fields: [transactions.boothId], references: [booths.id] }),
  tenant: one(tenants, { fields: [transactions.tenantId], references: [tenants.id] }),
  package: one(packages, { fields: [transactions.packageId], references: [packages.id] }),
}));
