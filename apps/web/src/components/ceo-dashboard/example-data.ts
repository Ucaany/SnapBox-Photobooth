/**
 * Data contoh untuk skeleton CEO Dashboard (PRD Task 1.3).
 *
 * Angka di sini dipilih kecil dan tidak bulat supaya terlihat sebagai dataset
 * contoh, tetapi TETAP wajib ditampilkan bersama label `DATA_CONTOH`. Tidak ada
 * nama orang nyata, email pelanggan, token, atau klaim uptime/compliance.
 */

export interface ExampleMetric {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly delta: string;
  /** Arah delta untuk pewarnaan; bukan keputusan bisnis. */
  readonly trend: 'naik' | 'turun' | 'datar';
  readonly hint: string;
}

export const CONTOH_METRICS: readonly ExampleMetric[] = [
  {
    id: 'tenant',
    label: 'Total tenant',
    value: '128',
    delta: '+6 bulan ini',
    trend: 'naik',
    hint: 'Termasuk 4 tenant berstatus trial.',
  },
  {
    id: 'booth',
    label: 'Booth aktif',
    value: '312',
    delta: '+18 bulan ini',
    trend: 'naik',
    hint: 'Booth terpairing dengan heartbeat < 5 menit.',
  },
  {
    id: 'mrr',
    label: 'MRR contoh',
    value: 'Rp 61,4',
    unit: 'juta',
    delta: '+4,2%',
    trend: 'naik',
    hint: 'Nilai contoh, bukan angka penagihan nyata.',
  },
  {
    id: 'churn',
    label: 'Churn bulanan',
    value: '1,8',
    unit: '%',
    delta: '-0,3 pt',
    trend: 'turun',
    hint: 'Selisih terhadap bulan sebelumnya.',
  },
];

export interface ExampleTenant {
  readonly id: string;
  readonly company: string;
  readonly ownerEmail: string;
  readonly plan: 'Starter' | 'Growth' | 'Enterprise';
  readonly status: 'Aktif' | 'Trial' | 'Suspend' | 'Grace period' | 'Banned';
  readonly outlets: number;
  readonly booths: number;
  readonly lastSeen: string;
}

/**
 * 20 tenant contoh (PRD Task 1.4: "tabel 20 tenant dummy dengan filter").
 *
 * Data tetap memakai domain `.example` dan angka kecil supaya tidak terbaca
 * sebagai pelanggan nyata. Id di sini BUKAN UUID: baris dummy tidak bisa dibuka
 * di halaman detail yang membaca DB, dan halaman itu memang mengembalikan 404
 * untuk id yang tidak ada.
 */
export const CONTOH_TENANTS: readonly ExampleTenant[] = [
  {
    id: 't-1042',
    company: 'Ruang Cepat Studio',
    ownerEmail: 'owner@ruangcepat.example',
    plan: 'Growth',
    status: 'Aktif',
    outlets: 3,
    booths: 7,
    lastSeen: '2 menit lalu',
  },
  {
    id: 't-1041',
    company: 'Kopi Senja Photobooth',
    ownerEmail: 'halo@kopisenja.example',
    plan: 'Starter',
    status: 'Trial',
    outlets: 1,
    booths: 1,
    lastSeen: '26 menit lalu',
  },
  {
    id: 't-1038',
    company: 'Momen Kota Malang',
    ownerEmail: 'admin@momenkota.example',
    plan: 'Enterprise',
    status: 'Aktif',
    outlets: 5,
    booths: 12,
    lastSeen: '1 jam lalu',
  },
  {
    id: 't-1035',
    company: 'Pixel Party Bandung',
    ownerEmail: 'owner@pixelparty.example',
    plan: 'Growth',
    status: 'Grace period',
    outlets: 2,
    booths: 4,
    lastSeen: '3 hari lalu',
  },
  {
    id: 't-1031',
    company: 'Bilik Foto Pasar Baru',
    ownerEmail: 'kontak@bilikfoto.example',
    plan: 'Starter',
    status: 'Suspend',
    outlets: 1,
    booths: 2,
    lastSeen: '12 hari lalu',
  },
  {
    id: 't-1027',
    company: 'Sisi Lain Studio',
    ownerEmail: 'ops@sisilain.example',
    plan: 'Growth',
    status: 'Aktif',
    outlets: 2,
    booths: 5,
    lastSeen: '8 menit lalu',
  },
  {
    id: 't-1024',
    company: 'Jepret Jaya Semarang',
    ownerEmail: 'admin@jepretjaya.example',
    plan: 'Starter',
    status: 'Aktif',
    outlets: 1,
    booths: 1,
    lastSeen: '14 menit lalu',
  },
  {
    id: 't-1020',
    company: 'Lorong Cahaya',
    ownerEmail: 'halo@lorongcahaya.example',
    plan: 'Growth',
    status: 'Aktif',
    outlets: 2,
    booths: 6,
    lastSeen: '31 menit lalu',
  },
  {
    id: 't-1017',
    company: 'Wajah Baru Bekasi',
    ownerEmail: 'owner@wajahbaru.example',
    plan: 'Starter',
    status: 'Trial',
    outlets: 1,
    booths: 2,
    lastSeen: '2 jam lalu',
  },
  {
    id: 't-1013',
    company: 'Potret Medan',
    ownerEmail: 'ops@potretmedan.example',
    plan: 'Enterprise',
    status: 'Aktif',
    outlets: 4,
    booths: 9,
    lastSeen: '5 menit lalu',
  },
  {
    id: 't-1009',
    company: 'Ceria Foto Solo',
    ownerEmail: 'kontak@ceriafoto.example',
    plan: 'Starter',
    status: 'Grace period',
    outlets: 1,
    booths: 1,
    lastSeen: '6 hari lalu',
  },
  {
    id: 't-1006',
    company: 'Kotak Kenangan',
    ownerEmail: 'admin@kotakkenangan.example',
    plan: 'Growth',
    status: 'Aktif',
    outlets: 3,
    booths: 7,
    lastSeen: '52 menit lalu',
  },
  {
    id: 't-1002',
    company: 'Studio Delapan',
    ownerEmail: 'owner@studiodelapan.example',
    plan: 'Growth',
    status: 'Banned',
    outlets: 2,
    booths: 3,
    lastSeen: '19 hari lalu',
  },
  {
    id: 't-0998',
    company: 'Bingkai Biru',
    ownerEmail: 'halo@bingkaibiru.example',
    plan: 'Starter',
    status: 'Aktif',
    outlets: 1,
    booths: 1,
    lastSeen: '3 jam lalu',
  },
  {
    id: 't-0995',
    company: 'Sorot Studio Yogyakarta',
    ownerEmail: 'ops@sorotstudio.example',
    plan: 'Enterprise',
    status: 'Aktif',
    outlets: 6,
    booths: 14,
    lastSeen: '1 menit lalu',
  },
  {
    id: 't-0991',
    company: 'Klik Kecil Tangerang',
    ownerEmail: 'admin@klikkecil.example',
    plan: 'Starter',
    status: 'Suspend',
    outlets: 1,
    booths: 2,
    lastSeen: '9 hari lalu',
  },
  {
    id: 't-0988',
    company: 'Pose Pekanbaru',
    ownerEmail: 'kontak@posepekanbaru.example',
    plan: 'Growth',
    status: 'Aktif',
    outlets: 2,
    booths: 4,
    lastSeen: '17 menit lalu',
  },
  {
    id: 't-0984',
    company: 'Tangkap Momen Bali',
    ownerEmail: 'owner@tangkapmomen.example',
    plan: 'Enterprise',
    status: 'Trial',
    outlets: 3,
    booths: 5,
    lastSeen: '4 jam lalu',
  },
  {
    id: 't-0980',
    company: 'Foto Riang Makassar',
    ownerEmail: 'halo@fotoriang.example',
    plan: 'Starter',
    status: 'Aktif',
    outlets: 1,
    booths: 1,
    lastSeen: '44 menit lalu',
  },
  {
    id: 't-0977',
    company: 'Nada Nada Photo',
    ownerEmail: 'admin@nadanada.example',
    plan: 'Growth',
    status: 'Grace period',
    outlets: 2,
    booths: 6,
    lastSeen: '4 hari lalu',
  },
];

export interface ExampleInvoice {
  readonly id: string;
  readonly invoiceNo: string;
  readonly tenant: string;
  readonly period: string;
  readonly amount: string;
  readonly status: 'Lunas' | 'Menunggu' | 'Gagal' | 'Kedaluwarsa';
  readonly issuedAt: string;
}

export const CONTOH_INVOICES: readonly ExampleInvoice[] = [
  {
    id: 'inv-9001',
    invoiceNo: 'INV-2026-0901',
    tenant: 'Ruang Cepat Studio',
    period: 'Sep 2026',
    amount: 'Rp 180.000',
    status: 'Lunas',
    issuedAt: '01 Sep 2026',
  },
  {
    id: 'inv-9002',
    invoiceNo: 'INV-2026-0902',
    tenant: 'Kopi Senja Photobooth',
    period: 'Sep 2026',
    amount: 'Rp 100.000',
    status: 'Menunggu',
    issuedAt: '02 Sep 2026',
  },
  {
    id: 'inv-9003',
    invoiceNo: 'INV-2026-0903',
    tenant: 'Momen Kota Malang',
    period: 'Sep 2026',
    amount: 'Rp 250.000',
    status: 'Lunas',
    issuedAt: '02 Sep 2026',
  },
  {
    id: 'inv-9004',
    invoiceNo: 'INV-2026-0904',
    tenant: 'Pixel Party Bandung',
    period: 'Agu 2026',
    amount: 'Rp 180.000',
    status: 'Gagal',
    issuedAt: '28 Agu 2026',
  },
  {
    id: 'inv-9005',
    invoiceNo: 'INV-2026-0905',
    tenant: 'Bilik Foto Pasar Baru',
    period: 'Agu 2026',
    amount: 'Rp 100.000',
    status: 'Kedaluwarsa',
    issuedAt: '20 Agu 2026',
  },
];

// Plan TIDAK punya data contoh: `/ceo-dashboard/plans` membaca tabel `plans`
// yang nyata dan mengeditnya (PRD Task 1.5). Menyimpan salinan dummy di sini
// hanya mengundang drift harga antara editor dan tagihan.

export interface ExampleDevice {
  readonly id: string;
  readonly device: string;
  readonly tenant: string;
  readonly outlet: string;
  readonly status: 'Online' | 'Idle' | 'Offline' | 'Maintenance';
  readonly appVersion: string;
  readonly os: string;
  readonly heartbeat: string;
}

export const CONTOH_DEVICES: readonly ExampleDevice[] = [
  {
    id: 'dev-5501',
    device: 'SBX-0142',
    tenant: 'Ruang Cepat Studio',
    outlet: 'Cabang Dago',
    status: 'Online',
    appVersion: '1.4.2',
    os: 'Windows 11',
    heartbeat: '18 detik lalu',
  },
  {
    id: 'dev-5502',
    device: 'SBX-0143',
    tenant: 'Ruang Cepat Studio',
    outlet: 'Cabang Dipatiukur',
    status: 'Online',
    appVersion: '1.4.2',
    os: 'Windows 11',
    heartbeat: '42 detik lalu',
  },
  {
    id: 'dev-5503',
    device: 'SBX-0207',
    tenant: 'Momen Kota Malang',
    outlet: 'Mall A',
    status: 'Idle',
    appVersion: '1.3.9',
    os: 'Windows 10',
    heartbeat: '4 menit lalu',
  },
  {
    id: 'dev-5504',
    device: 'SBX-0210',
    tenant: 'Pixel Party Bandung',
    outlet: 'Food Court',
    status: 'Offline',
    appVersion: '1.3.7',
    os: 'Windows 10',
    heartbeat: '3 hari lalu',
  },
  {
    id: 'dev-5505',
    device: 'SBX-0311',
    tenant: 'Sisi Lain Studio',
    outlet: 'Lantai 2',
    status: 'Maintenance',
    appVersion: '1.4.2',
    os: 'macOS 15',
    heartbeat: '26 menit lalu',
  },
];

export interface ExampleActivity {
  readonly id: string;
  readonly actor: string;
  readonly role: 'CEO' | 'OWNER' | 'STAFF' | 'Sistem';
  readonly action: string;
  readonly resource: string;
  readonly at: string;
}

export const CONTOH_ACTIVITIES: readonly ExampleActivity[] = [
  {
    id: 'log-8801',
    actor: 'ceo@snapbox.example',
    role: 'CEO',
    action: 'tenant.suspend',
    resource: 'Bilik Foto Pasar Baru',
    at: '25 Sep 2026, 09:12',
  },
  {
    id: 'log-8800',
    actor: 'ceo@snapbox.example',
    role: 'CEO',
    action: 'plan.update',
    resource: 'Growth / batas penyimpanan',
    at: '25 Sep 2026, 08:40',
  },
  {
    id: 'log-8799',
    actor: 'owner@pixelparty.example',
    role: 'OWNER',
    action: 'device.configure',
    resource: 'SBX-0210 / paper profile',
    at: '24 Sep 2026, 21:05',
  },
  {
    id: 'log-8798',
    actor: 'Sistem',
    role: 'Sistem',
    action: 'subscription.grace_period',
    resource: 'Pixel Party Bandung',
    at: '24 Sep 2026, 00:05',
  },
  {
    id: 'log-8797',
    actor: 'ops@sisilain.example',
    role: 'OWNER',
    action: 'booth.pair',
    resource: 'SBX-0311 / Sisi Lain Studio',
    at: '23 Sep 2026, 17:22',
  },
];

export interface ExampleService {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly status: 'Normal' | 'Perhatian' | 'Gangguan';
  readonly latency: string;
  readonly uptime: string;
}

export const CONTOH_SERVICES: readonly ExampleService[] = [
  {
    id: 'svc-supabase',
    name: 'Supabase Postgres',
    role: 'Database dan Realtime',
    status: 'Normal',
    latency: '38 ms',
    uptime: '99,94% (contoh)',
  },
  {
    id: 'svc-firebase',
    name: 'Firebase Auth',
    role: 'Identity provider',
    status: 'Normal',
    latency: '54 ms',
    uptime: '99,97% (contoh)',
  },
  {
    id: 'svc-cloudflare',
    name: 'Cloudflare',
    role: 'WAF, rate limit, DNS',
    status: 'Perhatian',
    latency: '61 ms',
    uptime: '99,90% (contoh)',
  },
  {
    id: 'svc-pakasir',
    name: 'Gateway B2B',
    role: 'Invoice langganan',
    status: 'Normal',
    latency: '120 ms',
    uptime: '99,88% (contoh)',
  },
  {
    id: 'svc-cron',
    name: 'pg_cron',
    role: 'Expiry dan pembersihan',
    status: 'Normal',
    latency: '0 ms',
    uptime: '99,99% (contoh)',
  },
];

export interface ExampleQueue {
  readonly id: string;
  readonly name: string;
  readonly pending: string;
  readonly failed: string;
  readonly lastRun: string;
}

export const CONTOH_QUEUES: readonly ExampleQueue[] = [
  {
    id: 'q-webhook',
    name: 'Webhook masuk',
    pending: '3',
    failed: '1',
    lastRun: '40 detik lalu',
  },
  {
    id: 'q-email',
    name: 'Email undangan',
    pending: '0',
    failed: '0',
    lastRun: '6 menit lalu',
  },
  {
    id: 'q-reconcile',
    name: 'Rekonsiliasi invoice',
    pending: '12',
    failed: '2',
    lastRun: '1 jam lalu',
  },
];

export interface ExampleSecurityEvent {
  readonly id: string;
  readonly kind: 'Login gagal' | 'Rate limit' | 'WAF' | 'Sesi';
  readonly subject: string;
  readonly source: string;
  readonly at: string;
  readonly detail: string;
}

export const CONTOH_SECURITY_EVENTS: readonly ExampleSecurityEvent[] = [
  {
    id: 'sec-7001',
    kind: 'Login gagal',
    subject: 'owner@bilikfoto.example',
    source: '103.0.0.0/24',
    at: '25 Sep 2026, 07:51',
    detail: '4 percobaan dalam 10 menit.',
  },
  {
    id: 'sec-7002',
    kind: 'Rate limit',
    subject: '/api/auth/session',
    source: '45.0.0.0/24',
    at: '25 Sep 2026, 06:14',
    detail: 'Batas per IP tercapai.',
  },
  {
    id: 'sec-7003',
    kind: 'WAF',
    subject: '/api/contact',
    source: 'WAF custom rule',
    at: '24 Sep 2026, 22:03',
    detail: 'Payload ditolak, tanpa dampak origin.',
  },
  {
    id: 'sec-7004',
    kind: 'Sesi',
    subject: 'ceo@snapbox.example',
    source: 'Perangkat tidak dikenal',
    at: '24 Sep 2026, 18:47',
    detail: 'Sesi baru terbit setelah login ulang.',
  },
];

export interface ExampleHealthAlert {
  readonly id: string;
  readonly title: string;
  readonly severity: 'Tinggi' | 'Sedang' | 'Rendah';
  readonly detail: string;
  readonly at: string;
}

export const CONTOH_ALERTS: readonly ExampleHealthAlert[] = [
  {
    id: 'alert-01',
    title: 'Webhook gagal berulang',
    severity: 'Tinggi',
    detail: 'Rekonsiliasi invoice punya 2 kegagalan berurutan.',
    at: '25 Sep 2026, 09:05',
  },
  {
    id: 'alert-02',
    title: 'Perangkat offline lama',
    severity: 'Sedang',
    detail: 'SBX-0210 tanpa heartbeat sejak 3 hari lalu.',
    at: '25 Sep 2026, 08:12',
  },
  {
    id: 'alert-03',
    title: 'Stok kertas menipis',
    severity: 'Rendah',
    detail: '2 booth melaporkan sisa kertas di bawah ambang.',
    at: '24 Sep 2026, 20:40',
  },
];

export interface ExampleGrowthPoint {
  readonly bulan: string;
  readonly tenant: number;
  readonly langganan: number;
}

export const CONTOH_GROWTH: readonly ExampleGrowthPoint[] = [
  { bulan: 'Apr', tenant: 96, langganan: 74 },
  { bulan: 'Mei', tenant: 104, langganan: 81 },
  { bulan: 'Jun', tenant: 111, langganan: 88 },
  { bulan: 'Jul', tenant: 117, langganan: 93 },
  { bulan: 'Agu', tenant: 122, langganan: 99 },
  { bulan: 'Sep', tenant: 128, langganan: 106 },
];
