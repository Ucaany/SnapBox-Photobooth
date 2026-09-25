import type { Metadata } from 'next';

import { findNavItem } from '@/components/ceo-dashboard/content';
import { TenantsView } from '@/components/ceo-dashboard/views/tenants-view';

/**
 * `/ceo-dashboard/tenants`: daftar tenant (PRD Task 1.3, diperluas di Task 1.4).
 *
 * Route eksplisit ini menang atas catch-all `[...segments]`, sehingga Task 1.4
 * bisa menambahkan `tenants/new` dan `tenants/[id]` tanpa menyentuh registry
 * skeleton. Tampilan daftar tetap di `TenantsView` supaya 1.3 dan 1.4 tidak
 * menghasilkan dua tabel tenant yang berbeda.
 */
const item = findNavItem('tenants');

export const metadata: Metadata = {
  title: item?.title ?? 'Manajemen tenant',
  description: item?.description,
};

export default function TenantsPage() {
  return <TenantsView />;
}
