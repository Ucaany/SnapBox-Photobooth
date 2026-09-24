/**
 * Kontrak custom claim Firebase SnapBox (PRD Bab 5, 10.3).
 *
 * Custom claim adalah sumber kebenaran peran. Klien boleh membacanya untuk
 * render, tetapi setiap keputusan otorisasi diulang di server.
 */
import { z } from 'zod';

import { customClaimsSchema, type CustomClaims } from '@snapbox/shared/auth';
import { userRoleSchema, type UserRole } from '@snapbox/shared/domain';

/**
 * Nilai claim `role` yang WAJIB ditanam ke token Firebase.
 *
 * Supabase selalu menimpa claim `role` di dalam JWT dengan peran Postgres milik
 * sesi. Untuk token pihak ketiga (Firebase), peran tersebut hanya bisa bernilai
 * `authenticated`; nilai lain membuat PostgREST menolak request. Karena itu
 * claim `role` TIDAK BISA dipakai untuk menyimpan peran aplikasi, dan
 * `app_metadata.role` tidak terjangkau lewat jalur token ini. Peran aplikasi
 * disimpan terpisah pada claim `app_role`.
 */
export const SUPABASE_POSTGRES_ROLE = 'authenticated' as const;

/**
 * Bentuk custom claim **sebagaimana tersimpan di token** (snake_case).
 *
 * Berbeda dari `customClaimsSchema` di `@snapbox/shared` yang menghadap
 * aplikasi (camelCase). Di sini `role` adalah peran Postgres Supabase sementara
 * peran aplikasi ada di `app_role`. Hanya key di bawah ini yang boleh ditanam:
 * key milik Firebase sendiri (`aud`, `iss`, `sub`, `iat`, `exp`, dst.) bersifat
 * reserved dan tidak boleh ditulis.
 */
export const firebaseClaimsSchema = z
  .object({
    role: z.literal(SUPABASE_POSTGRES_ROLE),
    app_role: userRoleSchema,
    tenant_id: z.string().uuid().nullable().optional(),
    parent_tenant_id: z.string().uuid().nullable().optional(),
  })
  .superRefine((claims, ctx) => {
    const tenantId = claims.tenant_id ?? null;
    const parentTenantId = claims.parent_tenant_id ?? null;

    if (claims.app_role === 'CEO' && (tenantId !== null || parentTenantId !== null)) {
      ctx.addIssue({
        code: 'custom',
        message: 'CEO tidak boleh terikat tenant: tenant_id dan parent_tenant_id harus null.',
      });
    }

    if (claims.app_role === 'OWNER' && tenantId === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'OWNER wajib memiliki tenant_id.',
      });
    }

    if (claims.app_role === 'STAFF' && tenantId === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'STAFF wajib memiliki tenant_id.',
      });
    }

    if (claims.app_role === 'STAFF' && parentTenantId === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'STAFF wajib memiliki parent_tenant_id.',
      });
    }
  });

export type FirebaseClaims = z.infer<typeof firebaseClaimsSchema>;

/** Input pembangun custom claim dalam bentuk camelCase milik aplikasi. */
export interface BuildCustomClaimsInput {
  readonly appRole: UserRole;
  readonly tenantId?: string | null;
  readonly parentTenantId?: string | null;
}

/**
 * Membangun custom claim Firebase dari peran aplikasi.
 *
 * `role` selalu diisi peran Postgres Supabase, dan peran aplikasi diletakkan di
 * `app_role`. `undefined` dinormalkan menjadi `null` agar tipe hasil tidak
 * menyimpan `undefined`.
 *
 * @param input Peran aplikasi beserta id tenant opsional.
 * @returns Custom claim siap ditanam lewat `setCustomUserClaims`.
 * @throws {z.ZodError} Bila kombinasi peran dan tenant melanggar invariant.
 */
export function buildCustomClaims(input: BuildCustomClaimsInput): FirebaseClaims {
  return firebaseClaimsSchema.parse({
    role: SUPABASE_POSTGRES_ROLE,
    app_role: input.appRole,
    tenant_id: input.tenantId ?? null,
    parent_tenant_id: input.parentTenantId ?? null,
  });
}

/**
 * Memetakan claim token (snake_case) ke `CustomClaims` yang menghadap aplikasi
 * (camelCase).
 *
 * @param decoded Isi token yang sudah didekode, bentuknya belum dipercaya.
 * @returns Custom claim versi aplikasi.
 * @throws {z.ZodError} Bila token tidak sesuai `firebaseClaimsSchema`.
 */
export function toCustomClaims(decoded: unknown): CustomClaims {
  const claims = firebaseClaimsSchema.parse(decoded);
  return customClaimsSchema.parse({
    role: claims.app_role,
    appRole: claims.app_role,
    tenantId: claims.tenant_id ?? null,
    parentTenantId: claims.parent_tenant_id ?? null,
  });
}
