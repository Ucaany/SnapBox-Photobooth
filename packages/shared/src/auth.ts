/**
 * Kontrak autentikasi & otorisasi SnapBox (PRD Bab 5, 10.3).
 *
 * Custom claim Firebase adalah sumber kebenaran peran. Klien boleh membaca
 * claim untuk keperluan render, tetapi SETIAP keputusan otorisasi diulang di
 * server: `tenant_id` dari klien tidak pernah dipercaya (PRD Bab 5.5).
 */
import { z } from 'zod';

import { userRoleSchema } from './domain';

/**
 * Permission granular (PRD Bab 5.2).
 * Format `resource.action`; dipakai oleh RBAC di service layer.
 */
export const PERMISSIONS = [
  'tenant.read',
  'tenant.create',
  'tenant.update',
  'tenant.suspend',
  'tenant.ban',
  'tenant.restore',
  'tenant.delete',
  'booth.read',
  'booth.create',
  'booth.update',
  'booth.delete',
  'booth.pair',
  'booth.revoke',
  'booth.maintenance',
  'device.read',
  'device.pair',
  'device.revoke',
  'device.configure',
  'device.diagnostics',
  'frame.read',
  'frame.create',
  'frame.update',
  'frame.delete',
  'frame.assign',
  'template.read',
  'template.create',
  'template.update',
  'template.delete',
  'package.read',
  'package.create',
  'package.update',
  'package.delete',
  'transaction.read',
  'transaction.export',
  'transaction.refund',
  'customer.read',
  'customer.read_masked',
  'customer.export',
  'payment.configure',
  'payment.test',
  'payment.read_credentials',
  'staff.create',
  'staff.update',
  'staff.disable',
  'subscription.read',
  'subscription.manage',
  'promo.read',
  'promo.create',
  'promo.update',
  'promo.delete',
  'promo.batch',
  'kiosk.theme.read',
  'kiosk.theme.update',
  'kiosk.theme.publish',
  'kiosk.lockdown',
  'report.read',
  'report.schedule',
  'report.export',
  'audit.read',
  'audit.export',
] as const;

export const permissionSchema = z.enum(PERMISSIONS);
export type Permission = z.infer<typeof permissionSchema>;

/**
 * Custom claim versi aplikasi (camelCase).
 *
 * PENTING: ini BUKAN bentuk klaim di dalam token. Kontrak wire/storage ada di
 * `packages/auth/src/claims.ts` (`firebaseClaimsSchema`, snake_case), lihat
 * ADR-003. Di token, `role` berisi peran Postgres Supabase (`authenticated`)
 * karena Supabase selalu menimpanya, dan peran aplikasi ada di `app_role`.
 * Objek ini memakai `appRole` untuk peran aplikasi supaya `Session.role`,
 * `hasPermission`, dan `canAccessTenant` tetap membaca nama peran aplikasi
 * dan tidak perlu berubah. Konversi token ke bentuk ini lewat `toCustomClaims`.
 *
 * `tenantId` hanya terisi untuk OWNER/STAFF; CEO tidak terikat tenant.
 */
export const customClaimsSchema = z.object({
  role: userRoleSchema,
  appRole: userRoleSchema,
  tenantId: z.string().uuid().nullable().optional(),
  parentTenantId: z.string().uuid().nullable().optional(),
});
export type CustomClaims = z.infer<typeof customClaimsSchema>;

/** Identitas pemanggil yang sudah diverifikasi server. */
export const sessionSchema = z.object({
  userId: z.string().uuid(),
  firebaseUid: z.string().min(1).max(128),
  email: z.string().email(),
  role: userRoleSchema,
  /** DILARANG diisi dari input klien. Selalu berasal dari claim token terverifikasi. */
  tenantId: z.string().uuid().nullable(),
  parentTenantId: z.string().uuid().nullable(),
});
export type Session = z.infer<typeof sessionSchema>;

/**
 * Peta peran ke permission. Ini satu-satunya tempat pemetaan ditulis;
 * service layer memanggil `hasPermission` alih-alih membandingkan role inline.
 */
const OWNER_PERMISSIONS: readonly Permission[] = [
  'booth.read',
  'booth.create',
  'booth.update',
  'booth.delete',
  'booth.pair',
  'booth.revoke',
  'booth.maintenance',
  'device.read',
  'device.pair',
  'device.revoke',
  'device.configure',
  'device.diagnostics',
  'frame.read',
  'frame.create',
  'frame.update',
  'frame.delete',
  'frame.assign',
  'template.read',
  'template.create',
  'template.update',
  'template.delete',
  'package.read',
  'package.create',
  'package.update',
  'package.delete',
  'transaction.read',
  'transaction.export',
  'transaction.refund',
  'customer.read',
  'customer.export',
  'payment.configure',
  'payment.test',
  'staff.create',
  'staff.update',
  'staff.disable',
  'subscription.read',
  'subscription.manage',
  'promo.read',
  'promo.create',
  'promo.update',
  'promo.delete',
  'promo.batch',
  'kiosk.theme.read',
  'kiosk.theme.update',
  'kiosk.theme.publish',
  'kiosk.lockdown',
  'report.read',
  'report.schedule',
  'report.export',
  'audit.read',
];

/** Staff hanya monitoring. Destructive action sengaja tidak ada di daftar ini. */
const STAFF_PERMISSIONS: readonly Permission[] = [
  'booth.read',
  'device.read',
  'device.diagnostics',
  'frame.read',
  'template.read',
  'package.read',
  'transaction.read',
  'customer.read_masked',
  'kiosk.theme.read',
  'report.read',
];

export const ROLE_PERMISSIONS: Readonly<Record<z.infer<typeof userRoleSchema>, readonly Permission[]>> =
  {
    CEO: PERMISSIONS,
    OWNER: OWNER_PERMISSIONS,
    STAFF: STAFF_PERMISSIONS,
  };

/**
 * Cek permission berbasis peran.
 *
 * @param role Peran dari session terverifikasi.
 * @param permission Permission yang diminta.
 * @returns `true` bila peran memiliki permission tersebut.
 */
export function hasPermission(role: Session['role'], permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Menegakkan isolasi tenant (PRD Bab 5.5).
 *
 * Aturan: CEO boleh lintas tenant. OWNER/STAFF hanya boleh menyentuh resource
 * dengan `tenant_id` yang sama dengan session. Pelanggaran mengembalikan
 * `false`, dan pemanggil WAJIB memetakannya ke 404, bukan 403.
 *
 * @param session Session terverifikasi server.
 * @param resourceTenantId Pemilik resource sebenarnya menurut DB.
 */
export function canAccessTenant(
  session: Session,
  resourceTenantId: string | null | undefined,
): boolean {
  if (session.role === 'CEO') {
    return true;
  }
  if (!session.tenantId || !resourceTenantId) {
    return false;
  }
  return session.tenantId === resourceTenantId;
}

/** Permission minimal per peran untuk routing middleware (PRD Bab 5.1). */
export const ROLE_HOME_ROUTE: Readonly<Record<z.infer<typeof userRoleSchema>, string>> = {
  CEO: '/ceo-dashboard',
  OWNER: '/owner-dashboard',
  STAFF: '/staff-dashboard',
};
