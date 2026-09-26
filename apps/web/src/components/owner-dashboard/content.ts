export type OwnerNavGroupId = 'utama' | 'operasional' | 'penjualan' | 'insight' | 'akun';

export interface OwnerNavGroup {
  readonly id: OwnerNavGroupId;
  readonly label: string;
}

export interface OwnerNavItem {
  readonly slug: string;
  readonly path: `/owner-dashboard${string}`;
  readonly label: string;
  readonly group: OwnerNavGroupId;
  readonly title: string;
  readonly description: string;
}

export const OWNER_NAV_GROUPS: readonly OwnerNavGroup[] = [
  { id: 'utama', label: 'Utama' },
  { id: 'operasional', label: 'Operasional' },
  { id: 'penjualan', label: 'Penjualan' },
  { id: 'insight', label: 'Insight' },
  { id: 'akun', label: 'Akun' },
];

export const OWNER_NAV_ITEMS: readonly OwnerNavItem[] = [
  {
    slug: '',
    path: '/owner-dashboard',
    label: 'Dashboard',
    group: 'utama',
    title: 'Dashboard',
    description: 'Ringkasan operasional SnapBox Anda.',
  },
  {
    slug: 'outlets',
    path: '/owner-dashboard/outlets',
    label: 'Outlet',
    group: 'operasional',
    title: 'Outlet',
    description: 'Kelola lokasi operasional photobooth.',
  },
  {
    slug: 'machines',
    path: '/owner-dashboard/machines',
    label: 'Mesin',
    group: 'operasional',
    title: 'Mesin',
    description: 'Daftar booth realtime, pairing device, dan konfigurasi per booth.',
  },
  {
    slug: 'devices',
    path: '/owner-dashboard/devices',
    label: 'Perangkat',
    group: 'operasional',
    title: 'Perangkat',
    description: 'Kelola perangkat klien yang terpasang.',
  },
  {
    slug: 'frame-studio',
    path: '/owner-dashboard/frame-studio',
    label: 'Frame Studio',
    group: 'operasional',
    title: 'Frame Studio',
    description: 'Buat dan kelola frame photobooth.',
  },
  {
    slug: 'templates',
    path: '/owner-dashboard/templates',
    label: 'Template',
    group: 'operasional',
    title: 'Template',
    description: 'Atur template sesi dan hasil foto.',
  },
  {
    slug: 'packages',
    path: '/owner-dashboard/packages',
    label: 'Paket',
    group: 'penjualan',
    title: 'Paket',
    description: 'Kelola paket layanan untuk pelanggan.',
  },
  {
    slug: 'kiosk-theme',
    path: '/owner-dashboard/kiosk-theme',
    label: 'Tema kiosk',
    group: 'operasional',
    title: 'Tema kiosk',
    description: 'Sesuaikan tampilan kiosk SnapBox.',
  },
  {
    slug: 'promos',
    path: '/owner-dashboard/promos',
    label: 'Promo',
    group: 'penjualan',
    title: 'Promo',
    description: 'Atur promo dan kode voucher.',
  },
  {
    slug: 'payment-settings',
    path: '/owner-dashboard/payment-settings',
    label: 'Pembayaran',
    group: 'penjualan',
    title: 'Pengaturan pembayaran',
    description: 'Atur metode dan gateway pembayaran.',
  },
  {
    slug: 'staff',
    path: '/owner-dashboard/staff',
    label: 'Staf',
    group: 'operasional',
    title: 'Staf',
    description: 'Kelola akses dan peran staf.',
  },
  {
    slug: 'customers',
    path: '/owner-dashboard/customers',
    label: 'Pelanggan',
    group: 'penjualan',
    title: 'Pelanggan',
    description: 'Lihat data pelanggan SnapBox.',
  },
  {
    slug: 'transactions',
    path: '/owner-dashboard/transactions',
    label: 'Transaksi',
    group: 'penjualan',
    title: 'Transaksi',
    description: 'Tinjau transaksi photobooth.',
  },
  {
    slug: 'finance',
    path: '/owner-dashboard/finance',
    label: 'Keuangan',
    group: 'insight',
    title: 'Keuangan',
    description: 'Pantau ringkasan keuangan bisnis.',
  },
  {
    slug: 'analytics',
    path: '/owner-dashboard/analytics',
    label: 'Analitik',
    group: 'insight',
    title: 'Analitik',
    description: 'Analisis performa outlet dan sesi.',
  },
  {
    slug: 'reports',
    path: '/owner-dashboard/reports',
    label: 'Laporan',
    group: 'insight',
    title: 'Laporan',
    description: 'Siapkan laporan operasional.',
  },
  {
    slug: 'subscription',
    path: '/owner-dashboard/subscription',
    label: 'Langganan',
    group: 'akun',
    title: 'Langganan',
    description: 'Tinjau plan dan langganan SnapBox.',
  },
  {
    slug: 'notifications',
    path: '/owner-dashboard/notifications',
    label: 'Notifikasi',
    group: 'akun',
    title: 'Notifikasi',
    description: 'Tinjau pemberitahuan akun dan operasional.',
  },
  {
    slug: 'settings',
    path: '/owner-dashboard/settings',
    label: 'Pengaturan',
    group: 'akun',
    title: 'Pengaturan',
    description: 'Atur preferensi akun dan bisnis.',
  },
  {
    slug: 'support',
    path: '/owner-dashboard/support',
    label: 'Dukungan',
    group: 'akun',
    title: 'Dukungan',
    description: 'Hubungi tim SnapBox untuk bantuan.',
  },
];

export function findOwnerNavItem(slug: string): OwnerNavItem | undefined {
  return OWNER_NAV_ITEMS.find((item) => item.slug === slug);
}

export function ownerNavItemsByGroup(group: OwnerNavGroupId): readonly OwnerNavItem[] {
  return OWNER_NAV_ITEMS.filter((item) => item.group === group);
}
