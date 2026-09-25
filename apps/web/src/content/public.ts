/**
 * Konten publik terpusat untuk landing SnapBox.
 *
 * Tidak ada JSX dan tidak ada dependensi runtime di file ini supaya bisa
 * diimpor dari server component, `generateMetadata`, `sitemap.ts`, `robots.ts`,
 * maupun helper JSON-LD tanpa menarik bundle klien.
 *
 * ATURAN KONTEN (WAJIB):
 * - Tidak ada konten yang boleh dikarang. Setiap field yang belum punya data
 *   nyata memakai placeholder eksplisit: `[REAL DATA]`, `[REAL PRICE]`,
 *   `[REAL TENANT LOGOS]`, atau status `Coming soon`, dengan `pending: true`.
 * - Tidak memakai em dash pada copy yang tampil. Gunakan tanda hubung atau
 *   susun ulang kalimat.
 */

export type PublicRouteHref =
  | '/'
  | '/tentang'
  | '/fitur'
  | '/harga'
  | '/kamera'
  | '/kontak'
  | '/docs/troubleshooting'
  | '/unduh-aplikasi';

export type PublicRoute = {
  readonly href: PublicRouteHref;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly isHome?: boolean;
};

export type PublicNavItem = {
  readonly href: PublicRouteHref;
  readonly label: string;
};

export type BrandPalette = {
  readonly yellow: string;
  readonly violet: string;
  readonly pink: string;
  readonly warmWhite: string;
  readonly cream: string;
  readonly ink: string;
  readonly success: string;
  readonly danger: string;
  readonly warning: string;
};

export type ValuePillar = {
  readonly name: string;
  readonly description: string;
};

export type HeroContent = {
  readonly product: string;
  readonly vision: string;
  readonly subCopy: string;
  readonly primaryCtaLabel: string;
  readonly primaryCtaHref: PublicRouteHref;
  readonly secondaryCtaLabel: string;
  readonly secondaryCtaHref: PublicRouteHref;
  readonly valuePillars: readonly ValuePillar[];
};

export type FeatureModule = {
  readonly name: string;
  readonly description: string;
  readonly pending: true;
  readonly mockupLabel: string;
};

export type PricingPlan = {
  readonly name: string;
  readonly price: string;
  readonly priceNote: string;
  readonly pending: true;
  readonly ctaLabel: string;
};

export type PricingContent = {
  readonly plans: readonly PricingPlan[];
  readonly consultationCtaLabel: string;
  readonly consultationCtaHref: PublicRouteHref;
  readonly checkoutAvailable: false;
  readonly note: string;
};

export type TroubleshootingStep = {
  readonly step: number;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly detail: string;
  readonly pending: true;
};

export type CameraStatus = 'pending';

export type CamerasContent = {
  readonly status: CameraStatus;
  readonly heading: string;
  readonly body: string;
  readonly note: string;
  readonly brands: readonly string[];
  readonly sdkNote: string;
};

export type DownloadPlatform = {
  readonly os: string;
  readonly format: string;
  readonly status: string;
};

export type DownloadContent = {
  readonly platforms: readonly DownloadPlatform[];
  readonly changelog: string;
  readonly minimumHardware: string;
  readonly pending: true;
};

export type ContactContent = {
  readonly whatsappEnvKey: string;
  readonly salesInfo: string;
  readonly address: string;
  readonly hours: string;
  readonly formStatus: 'unavailable';
};

export type FaqEntry = {
  readonly question: string;
  readonly answer: string;
};

export type TestimonialsContent = {
  readonly pending: true;
  readonly label: string;
  readonly body: string;
};

export type TenantsContent = {
  readonly pending: true;
  readonly label: string;
};

export type SiteContent = {
  readonly name: string;
  readonly description: string;
};

const PENDING = '[REAL DATA]' as const;

/**
 * Metadata delapan rute publik sesuai PRD Bab 8. Daftar ini adalah sumber
 * tunggal untuk sitemap, navigasi, dan metadata per halaman.
 */
export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  {
    href: '/',
    label: 'Beranda',
    title: 'SnapBox Photobooth',
    description:
      'Platform SaaS all-in-one (infrastructure + operating system) untuk bisnis photobooth yang menghubungkan Super Admin, Owner/Tenant, Outlet, Booth fisik, dan Customer.',
    isHome: true,
  },
  {
    href: '/tentang',
    label: 'Tentang Kami',
    title: 'Tentang SnapBox',
    description:
      'Cerita dan visi SnapBox: infrastruktur dan sistem operasi industri photobooth yang menghubungkan Super Admin, Owner/Tenant, Outlet, Booth fisik, dan Customer.',
  },
  {
    href: '/fitur',
    label: 'Fitur',
    title: 'Fitur SnapBox',
    description:
      'Modul Machine Manager, Frame Studio, Chroma Key, Promo Engine, Kiosk Customizer, dan Analytics untuk mengelola seluruh siklus hidup booth dari cloud.',
  },
  {
    href: '/harga',
    label: 'Harga',
    title: 'Harga dan Paket SnapBox',
    description:
      'Paket Starter, Growth, dan Enterprise untuk bisnis photobooth multi-tenant. Konsultasi dengan tim SnapBox untuk detail harga.',
  },
  {
    href: '/kamera',
    label: 'Dukungan Kamera',
    title: 'Dukungan Kamera',
    description:
      'Dukungan kamera SnapBox untuk DSLR/mirrorless Canon, Nikon, Sony, dan webcam pada aplikasi desktop kiosk.',
  },
  {
    href: '/kontak',
    label: 'Kontak',
    title: 'Hubungi SnapBox',
    description:
      'Hubungi tim SnapBox untuk konsultasi platform photobooth multi-tenant melalui kanal sales yang tersedia.',
  },
  {
    href: '/docs/troubleshooting',
    label: 'Troubleshooting',
    title: 'Troubleshooting Kamera',
    description:
      'Panduan enam langkah mendeteksi kamera pada kiosk SnapBox: kabel USB data, mode PTP, utility bawaan, format JPEG, auto power off, dan USB power supply.',
  },
  {
    href: '/unduh-aplikasi',
    label: 'Unduh Aplikasi',
    title: 'Unduh Aplikasi Desktop',
    description:
      'Installer aplikasi desktop SnapBox untuk Windows dan Linux beserta informasi changelog dan kebutuhan minimum perangkat.',
  },
];

/**
 * Item navigasi. Header hanya menampilkan tujuan utama; footer menampilkan
 * seluruh rute publik.
 */
export const PUBLIC_NAV: {
  readonly header: readonly PublicNavItem[];
  readonly footer: readonly PublicNavItem[];
} = {
  header: [
    { href: '/tentang', label: 'Tentang Kami' },
    { href: '/fitur', label: 'Fitur' },
    { href: '/harga', label: 'Harga' },
    { href: '/kamera', label: 'Kamera' },
    { href: '/docs/troubleshooting', label: 'Troubleshooting' },
  ],
  footer: PUBLIC_ROUTES.map((route) => ({ href: route.href, label: route.label })),
};

/**
 * Palet marketing SnapBox dari PRD. Konstanta ini terpisah dari token ADR-002
 * `@snapbox/ui` dan tidak menimpa token mana pun.
 */
export const BRAND: {
  readonly palette: BrandPalette;
  readonly shadow: string;
  readonly shadowPressed: string;
} = {
  palette: {
    yellow: '#FFDD00',
    violet: '#8B5CF6',
    pink: '#FF1F8F',
    warmWhite: '#FFFEF5',
    cream: '#F5F0DC',
    ink: '#141414',
    success: '#16A34A',
    danger: '#DC2626',
    warning: '#F59E0B',
  },
  shadow: '6px 6px 0 0 #141414',
  shadowPressed: '2px 2px 0 0 #141414',
};

/**
 * Hero. Kalimat visi ditulis ulang tanpa em dash (PRD memakai em dash);
 * maknanya tidak diubah.
 */
export const HERO: HeroContent = {
  product: 'SnapBox Photobooth',
  vision:
    'Menjadi infrastruktur dan sistem operasi industri photobooth yang membuat 1 booth bisa scale ke 1.000+ booth tanpa menambah kompleksitas operasional.',
  subCopy:
    'Platform SaaS all-in-one (infrastructure + operating system) untuk bisnis photobooth yang menghubungkan Super Admin, Owner/Tenant, Outlet, Booth fisik, dan Customer.',
  primaryCtaLabel: 'Konsultasi Gratis',
  primaryCtaHref: '/kontak',
  secondaryCtaLabel: 'Lihat Fitur',
  secondaryCtaHref: '/fitur',
  valuePillars: [
    {
      name: 'Zero-touch operation',
      description:
        'Seluruh konfigurasi harga, frame, tema, promo, dan printer diubah dari web, tanpa perlu ke lokasi.',
    },
    {
      name: 'Hardware-first',
      description: 'Mendukung DSLR/mirrorless profesional, bukan hanya webcam.',
    },
    {
      name: 'Server as source of truth',
      description: 'Kiosk tidak pernah memalsukan status PAID.',
    },
    {
      name: 'Graceful degradation',
      description: 'Internet mati bukan berarti fotografer tidak bisa jalan.',
    },
    {
      name: 'Multi-tenant isolation',
      description: 'Setiap tenant benar-benar terisolasi (RLS + ownership validation).',
    },
  ],
};

/**
 * Enam modul PRD. PRD tidak memberi deskripsi pemasaran untuk modul-modul ini,
 * jadi deskripsi sengaja dibiarkan `[REAL DATA]` dan `pending: true`. Teks
 * spesifikasi engineering tidak dipakai sebagai copy marketing.
 */
export const FEATURES: readonly FeatureModule[] = [
  {
    name: 'Machine Manager',
    description: PENDING,
    pending: true,
    mockupLabel: 'Demo frame',
  },
  {
    name: 'Frame Studio',
    description: PENDING,
    pending: true,
    mockupLabel: 'Demo frame',
  },
  {
    name: 'Chroma Key',
    description: PENDING,
    pending: true,
    mockupLabel: 'Demo frame',
  },
  {
    name: 'Promo Engine',
    description: PENDING,
    pending: true,
    mockupLabel: 'Demo frame',
  },
  {
    name: 'Kiosk Customizer',
    description: PENDING,
    pending: true,
    mockupLabel: 'Demo frame',
  },
  {
    name: 'Analytics',
    description: PENDING,
    pending: true,
    mockupLabel: 'Demo frame',
  },
];

/**
 * Paket harga. Nilai rupiah tidak disertakan sampai harga resmi dikonfirmasi.
 * Hanya jalur konsultasi, tanpa self-checkout.
 */
export const PRICING: PricingContent = {
  plans: [
    {
      name: 'Starter',
      price: 'Coming soon',
      priceNote: PENDING,
      pending: true,
      ctaLabel: 'Konsultasi',
    },
    {
      name: 'Growth',
      price: 'Coming soon',
      priceNote: PENDING,
      pending: true,
      ctaLabel: 'Konsultasi',
    },
    {
      name: 'Enterprise',
      price: 'Coming soon',
      priceNote: PENDING,
      pending: true,
      ctaLabel: 'Konsultasi',
    },
  ],
  consultationCtaLabel: 'Konsultasi Gratis',
  consultationCtaHref: '/kontak',
  checkoutAvailable: false,
  note: 'Harga final dikonfirmasi melalui konsultasi dengan tim SnapBox.',
};

/**
 * Enam langkah troubleshooting sesuai PRD (label saja). PRD tidak menyediakan
 * prosa isi langkah, jadi `description` dan `detail` tidak dikarang.
 */
export const TROUBLESHOOTING_STEPS: readonly TroubleshootingStep[] = [
  {
    step: 1,
    label: 'USB data',
    title: 'Gunakan kabel USB data',
    description: PENDING,
    detail: PENDING,
    pending: true,
  },
  {
    step: 2,
    label: 'mode PTP',
    title: 'Aktifkan mode PTP',
    description: PENDING,
    detail: PENDING,
    pending: true,
  },
  {
    step: 3,
    label: 'tutup utility bawaan',
    title: 'Tutup utility bawaan kamera',
    description: PENDING,
    detail: PENDING,
    pending: true,
  },
  {
    step: 4,
    label: 'JPEG L',
    title: 'Set format JPEG L',
    description: PENDING,
    detail: PENDING,
    pending: true,
  },
  {
    step: 5,
    label: 'auto power off',
    title: 'Matikan auto power off',
    description: PENDING,
    detail: PENDING,
    pending: true,
  },
  {
    step: 6,
    label: 'USB power supply Sony',
    title: 'Siapkan USB power supply Sony',
    description: PENDING,
    detail: PENDING,
    pending: true,
  },
];

/**
 * Registry kamera belum tersedia. Jumlah kamera tidak diklaim sampai data nyata
 * ada (PRD menyebut angka pemasaran yang belum terverifikasi, jadi tidak
 * dicetak).
 */
export const CAMERAS: CamerasContent = {
  status: 'pending',
  heading: 'Registry kamera sedang disiapkan',
  body: 'Registry kamera sedang disiapkan.',
  note: PENDING,
  brands: ['Canon', 'Nikon', 'Sony', 'Webcam'],
  sdkNote: 'Canon EDSDK, Nikon PTP, Sony Camera Remote SDK, Webcam',
};

/**
 * Distribusi installer belum rilis. Tidak ada anchor unduhan mati.
 */
export const DOWNLOAD: DownloadContent = {
  platforms: [
    { os: 'Windows', format: '.exe (NSIS)', status: 'Coming soon' },
    { os: 'Linux', format: '.deb', status: 'Coming soon' },
  ],
  changelog: 'Coming soon',
  minimumHardware: PENDING,
  pending: true,
};

/**
 * Kontak. Nomor WhatsApp dibaca dari env `NEXT_PUBLIC_SALES_WHATSAPP`; tanpa
 * nilai valid, CTA dirender sebagai state tidak tersedia. Form kontak belum
 * punya endpoint nyata.
 */
export const CONTACT: ContactContent = {
  whatsappEnvKey: 'NEXT_PUBLIC_SALES_WHATSAPP',
  salesInfo: PENDING,
  address: PENDING,
  hours: PENDING,
  formStatus: 'unavailable',
};

/**
 * FAQ produk. Hanya memuat fakta yang sudah terkonfirmasi di PRD. Tidak ada
 * angka, klaim performa, atau harga yang belum terverifikasi.
 */
export const FAQ: readonly FaqEntry[] = [
  {
    question: 'Apa itu SnapBox?',
    answer:
      'SnapBox adalah platform SaaS all-in-one (infrastructure + operating system) untuk bisnis photobooth yang menghubungkan Super Admin, Owner/Tenant, Outlet, Booth fisik, dan Customer.',
  },
  {
    question: 'Modul apa saja yang tersedia?',
    answer:
      'Terdapat enam modul: Machine Manager, Frame Studio, Chroma Key, Promo Engine, Kiosk Customizer, dan Analytics.',
  },
  {
    question: 'Kamera apa yang didukung?',
    answer:
      'SnapBox bersifat hardware-first dan mendukung DSLR/mirrorless profesional (Canon, Nikon, Sony) selain webcam melalui aplikasi desktop kiosk.',
  },
  {
    question: 'Apakah booth tetap bisa jalan saat internet mati?',
    answer:
      'Ya. SnapBox menerapkan graceful degradation sehingga capture dan cetak tetap berjalan untuk transaksi yang sudah berstatus PAID saat koneksi terputus.',
  },
  {
    question: 'Bagaimana isolasi data antar tenant dijaga?',
    answer:
      'Setiap tenant terisolasi dengan row level security dan ownership validation, sehingga data satu tenant tidak dapat diakses tenant lain.',
  },
  {
    question: 'Aplikasi desktop tersedia untuk sistem apa?',
    answer:
      'Aplikasi desktop kiosk SnapBox disediakan untuk Windows (.exe NSIS) dan Linux (.deb). Ketersediaan installer diumumkan pada halaman unduh aplikasi.',
  },
  {
    question: 'Apakah cetak otomatis didukung?',
    answer:
      'Ya. Kiosk SnapBox mendukung alur cetak otomatis setelah sesi foto selesai sesuai konfigurasi paket.',
  },
];

/**
 * Testimoni belum ada. Tidak ada kutipan atau nama fiktif.
 */
export const TESTIMONIALS: TestimonialsContent = {
  pending: true,
  label: PENDING,
  body: 'Testimoni pelanggan akan ditampilkan setelah verifikasi.',
};

/**
 * Logo tenant belum ada. Tidak ada nama atau logo fiktif.
 */
export const TENANTS: TenantsContent = {
  pending: true,
  label: '[REAL TENANT LOGOS]',
};

/**
 * Konstanta JSON-LD aman. Tidak ada `url`, `logo`, alamat, telepon, atau tautan
 * sosial karena belum ada data resmi.
 */
export const SITE: SiteContent = {
  name: 'SnapBox Photobooth',
  description:
    'Platform SaaS all-in-one (infrastructure + operating system) manajemen photobooth multi-tenant yang menghubungkan Super Admin, Owner/Tenant, Outlet, Booth fisik, dan Customer.',
};
