/**
 * Kontrak autentikasi SnapBox (PRD Bab 5, 10.3).
 *
 * Custom claim Firebase adalah sumber kebenaran peran. Klien boleh membaca
 * claim untuk keperluan render, tetapi SETIAP keputusan otorisasi diulang di
 * server: `tenant_id` dari klien tidak pernah dipercaya (PRD Bab 5.5).
 *
 * Otorisasi di SnapBox bersifat PERAN, bukan permission. Enforced di
 * `requireCeo()` dan `requireOwnerTenant()`; lihat catatan keputusan di bawah
 * berkas ini untuk kenapa modul permission dihapus (ADR-009).
 */
import { z } from 'zod';

import { userRoleSchema } from './domain';

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

/*
 * CATATAN KEPUTUSAN (ADR-009, menjawab D-04).
 *
 * Modul ini DULU mengekspor enum 75 izin, tiga peta peran, dan dua helper
 * pemeriksa. Semuanya TIDAK PUNYA importer:
 * enforcement yang benar adalah perbandingan role di `requireCeo()` dan
 * `requireOwnerTenant()` plus `tenant_id` yang selalu diambil dari baris DB.
 *
 * Modul yang dibiarkan menggantung lebih berbahaya dari yang tidak pernah ada:
 * `STAFF_PERMISSIONS` terdokumentasi sebagai "destructive action sengaja tidak
 * ada di daftar ini", dan itu memberi kesan Staff sudah diamankan padahal tidak
 * ada kode yang membacanya. Kenamanan Staff saat ini adalah route
 * `/staff-dashboard` yang belum ada — sebuah ketidaksengaja, bukan aturan yang
 * ditegakkan. Route itu DILARANG dibangun tanpa keputusan RBAC baru.
 *
 * Akses berbutir nanti dibangun dari TABEL database, bukan enum di sini,
 * karena perubahan daftar permission akan jadi perubahan kode untuk setiap
 * penyesuaian kebijakan. Sampai itu ada, lihat `route-policy.ts` untuk tujuan
 * rute per peran.
 */
