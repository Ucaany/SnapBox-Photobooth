/**
 * Registry konten skeleton CEO Dashboard (PRD Task 1.3).
 *
 * Satu sumber untuk tiga konsumen yang HARUS tidak drift:
 * - daftar item sidebar (label, group, urutan),
 * - segmen route per halaman (`/ceo-dashboard/<slug>`),
 * - judul + deskripsi header dan metadata halaman.
 *
 * Semua angka, tenant, device, event, dan status di bawah adalah DATA CONTOH,
 * bukan telemetry produksi. Setiap tampilan yang memuatnya wajib memakai label
 * `DATA_CONTOH` supaya tidak terbaca sebagai klaim nyata (R-17/R-36/R-38).
 *
 * Modul ini bebas dari `next/*`, DB, dan SDK apa pun sehingga aman diimpor
 * server component maupun client shell.
 */

export const DATA_CONTOH = 'Data contoh' as const;

/** Catatan status skeleton, dipakai sidebar dan menu akun. */
export const SKELETON_NOTE = 'Skeleton Fase 1. Belum tersambung ke data atau aksi nyata.' as const;

export interface CeoNavItem {
  /** Segmen route; `''` untuk root `/ceo-dashboard`. */
  readonly slug: string;
  readonly path: `/ceo-dashboard${string}`;
  readonly label: string;
  /** Group sidebar; menentukan urutan render. */
  readonly group: CeoNavGroupId;
  readonly title: string;
  readonly description: string;
}

export type CeoNavGroupId = 'ringkasan' | 'operasional' | 'platform';

export interface CeoNavGroup {
  readonly id: CeoNavGroupId;
  readonly label: string;
}

export const CEO_NAV_GROUPS: readonly CeoNavGroup[] = [
  { id: 'ringkasan', label: 'Ringkasan' },
  { id: 'operasional', label: 'Operasional' },
  { id: 'platform', label: 'Platform' },
];

/**
 * Urutan di array ini adalah urutan sidebar. Slug harus cocok dengan folder
 * route di `src/app/(ceo-dashboard)/ceo-dashboard/`.
 */
export const CEO_NAV_ITEMS: readonly CeoNavItem[] = [
  {
    slug: '',
    path: '/ceo-dashboard',
    label: 'Dashboard',
    group: 'ringkasan',
    title: 'Ringkasan platform',
    description: 'Metrik lintas tenant, pertumbuhan langganan, dan alert sistem dalam satu layar.',
  },
  {
    slug: 'tenants',
    path: '/ceo-dashboard/tenants',
    label: 'Tenant',
    group: 'ringkasan',
    title: 'Manajemen tenant',
    description: 'Daftar tenant beserta plan, status, dan kontak Owner.',
  },
  {
    slug: 'subscriptions',
    path: '/ceo-dashboard/subscriptions',
    label: 'Langganan',
    group: 'ringkasan',
    title: 'Langganan global',
    description: 'Invoice B2B lintas tenant, status pembayaran, dan invoice gagal.',
  },
  {
    slug: 'plans',
    path: '/ceo-dashboard/plans',
    label: 'Paket & harga',
    group: 'operasional',
    title: 'Paket dan harga',
    description: 'Batas fitur dan harga tiap plan, termasuk add-on perangkat.',
  },
  {
    slug: 'devices',
    path: '/ceo-dashboard/devices',
    label: 'Perangkat',
    group: 'operasional',
    title: 'Monitor perangkat',
    description: 'Semua perangkat Tauri lintas tenant: versi, sistem operasi, dan heartbeat.',
  },
  {
    slug: 'broadcast',
    path: '/ceo-dashboard/broadcast',
    label: 'Broadcast',
    group: 'operasional',
    title: 'Broadcast',
    description: 'Susun pengumuman untuk semua tenant atau tenant terpilih.',
  },
  {
    slug: 'promos',
    path: '/ceo-dashboard/promos',
    label: 'Promo',
    group: 'operasional',
    title: 'Promo global',
    description: 'Voucher platform-wide, masa aktif, dan kuota pemakaian.',
  },
  {
    slug: 'activity-log',
    path: '/ceo-dashboard/activity-log',
    label: 'Activity log',
    group: 'platform',
    title: 'Activity log',
    description: 'Jejak audit aksi kritis: aktor, aksi, resource, dan waktu.',
  },
  {
    slug: 'settings',
    path: '/ceo-dashboard/settings',
    label: 'Pengaturan',
    group: 'platform',
    title: 'Pengaturan global',
    description: 'Kontak penjualan, template email, feature flag, dan kunci API master.',
  },
  {
    slug: 'system-health',
    path: '/ceo-dashboard/system-health',
    label: 'Kesehatan sistem',
    group: 'platform',
    title: 'Kesehatan sistem',
    description: 'Status layanan, antrean webhook, dan jadwal cron.',
  },
  {
    slug: 'security',
    path: '/ceo-dashboard/security',
    label: 'Keamanan',
    group: 'platform',
    title: 'Keamanan',
    description: 'Percobaan login gagal, rate limit, event WAF, dan sesi aktif.',
  },
];

/** Cari item nav dari slug segmen (`''` untuk root). */
export function findNavItem(slug: string): CeoNavItem | undefined {
  return CEO_NAV_ITEMS.find((item) => item.slug === slug);
}

/**
 * Apakah slug segmen punya halaman. Dipakai server page untuk memutuskan
 * `notFound()` sebelum merender komponen klien, sehingga modul ini harus tetap
 * bebas `next/*` dan bebas komponen klien.
 */
export function isCeoSlug(slug: string): boolean {
  return CEO_NAV_ITEMS.some((item) => item.slug === slug);
}

/** Item nav per group, mempertahankan urutan registry. */
export function navItemsByGroup(group: CeoNavGroupId): readonly CeoNavItem[] {
  return CEO_NAV_ITEMS.filter((item) => item.group === group);
}
