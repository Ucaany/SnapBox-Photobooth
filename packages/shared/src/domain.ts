/**
 * Tipe domain SnapBox.
 *
 * Enum di sini adalah **sumber kebenaran tunggal** untuk nilai yang dipakai
 * bersama oleh wire (API/realtime) dan storage. `packages/db` menurunkan
 * `pgEnum` dari array yang sama sehingga tidak ada dua daftar nilai yang
 * bisa saling menyimpang.
 */
import { z } from 'zod';

// ============ ENUM SOURCE (dipakai juga oleh Drizzle pgEnum) ============

export const USER_ROLES = ['CEO', 'OWNER', 'STAFF'] as const;
export const TENANT_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'] as const;
export const PLAN_TIERS = ['STARTER', 'GROWTH', 'ENTERPRISE'] as const;
export const SUBSCRIPTION_STATUSES = [
  'PENDING',
  'ACTIVE',
  'EXPIRING',
  'GRACE_PERIOD',
  'EXPIRED',
  'SUSPENDED',
  'CANCELLED',
] as const;
export const BOOTH_STATUSES = ['ONLINE', 'OFFLINE', 'MAINTENANCE', 'UNPAIRED', 'DEGRADED'] as const;
export const PAYMENT_METHODS = [
  'CASH',
  'QRIS_MIDTRANS',
  'QRIS_XENDIT',
  'QRIS_DOKU',
  'QRIS_PAKASIR',
  'VOUCHER',
] as const;
export const PAYMENT_STATUSES = [
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED',
] as const;
export const PROMO_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT'] as const;
export const GATEWAY_PROVIDERS = ['MIDTRANS', 'XENDIT', 'DOKU', 'PAKASIR'] as const;
export const GATEWAY_MODES = ['SANDBOX', 'PRODUCTION'] as const;
export const NOTIFICATION_TYPES = [
  'LOW_PAPER',
  'BOOTH_OFFLINE',
  'SUBSCRIPTION_EXPIRING',
  'PAYMENT_PAID',
  'PRINTER_ERROR',
  'DEVICE_PAIRED',
  'DEVICE_REVOKED',
  'BROADCAST',
  'GENERAL',
  'CAMERA_ERROR',
] as const;
export const KIOSK_PANEL_STYLES = ['CLASSIC', 'CARD', 'RECEIPT'] as const;
export const ORIENTATIONS = ['LANDSCAPE', 'PORTRAIT'] as const;
export const CAMERA_STATUSES = [
  'SUPPORTED',
  'LIMITED',
  'EXPERIMENTAL',
  'NOT_SUPPORTED',
  'DEPRECATED',
] as const;
export const CHROMA_KEY_LEVELS = ['AUTO', 'ADVANCED', 'MULTILAYER'] as const;
export const FILTER_LEVELS = ['BASIC', 'ADJUST', 'CUSTOM_LUT'] as const;
export const FRAME_LAYERS = ['FRONT', 'BACK', 'OVERLAY'] as const;
export const NOTIFICATION_SEVERITIES = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const;
export const LOG_LEVELS = ['DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL'] as const;

// ============ ENUM SCHEMA (validasi Zod) ============

export const userRoleSchema = z.enum(USER_ROLES);
export const tenantStatusSchema = z.enum(TENANT_STATUSES);
export const planTierSchema = z.enum(PLAN_TIERS);
export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);
export const boothStatusSchema = z.enum(BOOTH_STATUSES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const promoTypeSchema = z.enum(PROMO_TYPES);
export const gatewayProviderSchema = z.enum(GATEWAY_PROVIDERS);
export const gatewayModeSchema = z.enum(GATEWAY_MODES);
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export const kioskPanelStyleSchema = z.enum(KIOSK_PANEL_STYLES);
export const orientationSchema = z.enum(ORIENTATIONS);
export const cameraStatusSchema = z.enum(CAMERA_STATUSES);
export const chromaKeyLevelSchema = z.enum(CHROMA_KEY_LEVELS);
export const filterLevelSchema = z.enum(FILTER_LEVELS);
export const frameLayerSchema = z.enum(FRAME_LAYERS);
export const notificationSeveritySchema = z.enum(NOTIFICATION_SEVERITIES);
export const logLevelSchema = z.enum(LOG_LEVELS);

export type UserRole = z.infer<typeof userRoleSchema>;
export type TenantStatus = z.infer<typeof tenantStatusSchema>;
export type PlanTier = z.infer<typeof planTierSchema>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export type BoothStatus = z.infer<typeof boothStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type PromoType = z.infer<typeof promoTypeSchema>;
export type GatewayProvider = z.infer<typeof gatewayProviderSchema>;
export type GatewayMode = z.infer<typeof gatewayModeSchema>;
export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type KioskPanelStyle = z.infer<typeof kioskPanelStyleSchema>;
export type Orientation = z.infer<typeof orientationSchema>;
export type CameraStatus = z.infer<typeof cameraStatusSchema>;
export type ChromaKeyLevel = z.infer<typeof chromaKeyLevelSchema>;
export type FilterLevel = z.infer<typeof filterLevelSchema>;
export type FrameLayer = z.infer<typeof frameLayerSchema>;
export type NotificationSeverity = z.infer<typeof notificationSeveritySchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;

// ============ PRIMITIVE BERSAMA ============

/** UUID v4. Dipakai sebagai identitas resource di seluruh API. */
export const uuidSchema = z.string().uuid();

/** Kode transaksi publik, contoh: `TRX-251112-001234`. */
export const trxCodeSchema = z
  .string()
  .regex(/^TRX-\d{6}-\d{6}$/, 'Format kode transaksi harus TRX-YYMMDD-NNNNNN.');

/** Kode voucher: alfanumerik 4 sampai 20 karakter, case-insensitive (PRD Bab 6.F). */
export const voucherCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(20)
  .regex(/^[A-Za-z0-9]+$/, 'Kode voucher hanya boleh huruf dan angka.')
  .transform((value) => value.toUpperCase());

/** Warna hex 6 digit, contoh `#FFDD00`. */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Warna harus format hex 6 digit, contoh #FFDD00.');

/** Nilai rupiah non-negatif, dikirim sebagai string agar presisi desimal aman. */
export const moneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Nilai uang harus berupa angka desimal, contoh "35000" atau "63750.50".');

/** Persentase 0 sampai 100. */
export const percentageSchema = z.number().min(0).max(100);

/** Halaman paginasi standar untuk endpoint daftar. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof paginationSchema>;
