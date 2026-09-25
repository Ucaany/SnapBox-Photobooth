/**
 * Kebijakan akses rute privat: satu sumber daftar protected route + peran.
 *
 * Dipisah dari `middleware.ts` dan dari helper DB karena tiga konsumen berbeda
 * membutuhkannya:
 *
 * - `middleware.ts` (Edge): memetakan path ke kebutuhan akses, tanpa menyentuh
 *   `firebase-admin`/Postgres.
 * - Route server / layout privat: mengulang pemeriksaan yang sama terhadap DB
 *   (snapshot cookie BUKAN otorisasi final).
 * - `/unauthorized`: menentukan tautan "kembali" yang aman.
 *
 * Modul ini sengaja TIDAK mengimpor `next/*`, DB, atau SDK Firebase, sehingga
 * aman di-bundle ke Edge.
 */
import type { UserRole } from '@snapbox/shared/domain';

/** Fase Task 1.2: hanya route privat yang sudah punya halaman (unauthorized). */
const PROTECTED_ROUTE_PREFIXES = [
  '/ceo-dashboard',
  '/owner-dashboard',
  '/staff-dashboard',
  '/dashboard',
] as const;

/** Semua peran aplikasi; dipakai untuk rute yang mengizinkan ketiganya. */
const ALL_ROLES: readonly UserRole[] = ['CEO', 'OWNER', 'STAFF'];

/** Rute privat yang boleh dibuka OWNER walau langganan tidak aktif. */
const SUBSCRIPTION_EXEMPT_PREFIXES = ['/owner-dashboard/subscription'] as const;

interface RouteAccessRule {
  readonly prefix: string;
  readonly roles: readonly UserRole[];
}

/**
 * Aturan peran per prefix. Urutan penting: prefix terpanjang dicek lebih dulu
 * supaya tidak ada aturan umum yang menutupi aturan spesifik.
 */
const ROUTE_ACCESS_RULES: readonly RouteAccessRule[] = [
  { prefix: '/ceo-dashboard', roles: ['CEO'] },
  { prefix: '/owner-dashboard', roles: ['OWNER'] },
  { prefix: '/staff-dashboard', roles: ['STAFF'] },
  { prefix: '/dashboard', roles: ALL_ROLES },
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Rute yang dilindungi middleware. */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/** Aturan yang berlaku untuk satu path, atau `null` bila path publik. */
export function findRouteRule(pathname: string): RouteAccessRule | null {
  return ROUTE_ACCESS_RULES.find((rule) => matchesPrefix(pathname, rule.prefix)) ?? null;
}

/**
 * Rute yang BOLEH dibuka saat langganan tenant tidak aktif.
 *
 * OWNER tanpa langganan aktif harus tetap bisa memperpanjang, jadi halaman
 * langganan dikecualikan (PRD Bab 6.J: "Owner tidak bisa akses dashboard saat
 * expired kecuali /owner-dashboard/subscription").
 */
export function isSubscriptionExempt(pathname: string): boolean {
  return SUBSCRIPTION_EXEMPT_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/**
 * Rute aman untuk peran setelah login / dari `/unauthorized`.
 *
 * Fase 1: dashboard untuk OWNER/STAFF belum ada, jadi jangan arahkan ke sana.
 * Fallback `null` berarti "tidak ada tujuan aman" dan pemanggil harus
 * menampilkan pesan netral, bukan tautan mati.
 */
export function safeHomeForRole(role: UserRole): string | null {
  return role === 'CEO' ? '/ceo-dashboard' : null;
}

/**
 * Memvalidasi parameter `?next=` dari redirect login.
 *
 * Hanya menerima path relatif same-origin. Absolute URL, protocol-relative
 * (`//evil.com`), backslash trick, dan CR/LF ditolak supaya tidak jadi
 * open redirect. Nilai `null` berarti pemanggil memakai tujuan default.
 */
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  if (value.includes('\\') || value.includes('\n') || value.includes('\r')) return null;
  if (value.includes('://')) return null;

  return value;
}
