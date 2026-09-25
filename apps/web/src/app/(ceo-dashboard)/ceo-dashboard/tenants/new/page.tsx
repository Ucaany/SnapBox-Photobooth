import type { Metadata } from 'next';

import { listPlanOptions } from '@/lib/ceo-dashboard/tenant-server';

import { TenantProvisioningWizard } from './tenant-provisioning-wizard';

export const metadata: Metadata = {
  title: 'Tenant baru',
  description: 'Wizard tiga langkah untuk menyiapkan tenant dan mengundang Owner.',
  robots: { index: false, follow: false },
};

/**
 * Halaman ini membaca `plans` dari DB dan berada di balik sesi CEO, jadi tidak
 * boleh dirender statis saat build: build tidak punya sesi, dan di CI kredensial
 * DB runtime memang tidak tersedia.
 */
export const dynamic = 'force-dynamic';

/**
 * `/ceo-dashboard/tenants/new` (PRD Task 1.4).
 *
 * Server component memuat plan canonical dari tabel `plans` supaya langkah
 * "Plan & Duration" menampilkan harga nyata, bukan angka yang ditulis ulang di
 * komponen. Otorisasi sudah dilakukan middleware; server action tetap
 * memeriksanya ulang.
 */
export default async function NewTenantPage() {
  const planOptions = await listPlanOptions();

  return <TenantProvisioningWizard planOptions={planOptions} />;
}
