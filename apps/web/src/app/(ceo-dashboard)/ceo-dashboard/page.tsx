import type { Metadata } from 'next';

import { DashboardView } from '@/components/ceo-dashboard/views/dashboard-view';
import { findNavItem } from '@/components/ceo-dashboard/content';

/**
 * `/ceo-dashboard`: dashboard utama CEO (PRD Task 1.3 baris 119).
 *
 * Server component dengan metadata sendiri. `[...segments]` tidak cocok untuk
 * segmen kosong, jadi root punya file ini supaya slug `''` tetap satu
 * implementasi dengan view registry.
 */
const item = findNavItem('');

export const metadata: Metadata = {
  title: item?.title ?? 'Ringkasan platform',
  description: item?.description,
};

export default function CeoDashboardHomePage() {
  return <DashboardView />;
}
