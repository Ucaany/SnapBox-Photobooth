import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { listPlanOptions, TenantServerError } from '@/lib/ceo-dashboard/tenant-server';

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
 * komponen. Otorisasi TIDAK hanya di middleware: `listPlanOptions()` memanggil
 * `requireCeo()` di dalam loader, jadi halaman ini aman walau suatu saat
 * middleware berubah.
 */
export default async function NewTenantPage() {
  try {
    const planOptions = await listPlanOptions();
    return <TenantProvisioningWizard planOptions={planOptions} />;
  } catch (error) {
    // Sama seperti halaman detail: sesi yang bukan CEO (atau yang sudah dicabut)
    // dijawab 404, bukan 403. `listPlanOptions()` memanggil `requireCeo()` di
    // dalamnya, jadi gerbangnya ada di loader dan halaman ini tidak bisa
    // melewatinya hanya dengan menambahkan loader baru.
    if (error instanceof TenantServerError) {
      if (error.code === 'NOT_FOUND' || error.code === 'UNAUTHORIZED') notFound();
    }
    throw error;
  }
}
