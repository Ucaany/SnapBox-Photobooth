import type { Metadata } from 'next';

import { findNavItem } from '@/components/ceo-dashboard/content';
import { listSubscriptionInvoices } from '@/lib/ceo-dashboard/subscription-server';

import { SubscriptionsClient } from './subscriptions-client';

/**
 * `/ceo-dashboard/subscriptions` (PRD Task 1.6).
 *
 * Server component memuat invoice NYATA dari `b2b_subscriptions` (join tenant +
 * plan). Route eksplisit ini menang atas catch-all `[...segments]`.
 *
 * Kegagalan DB TIDAK jatuh ke data contoh: error dibiarkan melempar sehingga
 * halaman menampilkan error, bukan tabel dummy yang menyamar sebagai data asli.
 * Fallback contoh hanya dipakai ketika query SUKSES tetapi kosong.
 *
 * `force-dynamic` di layout `/ceo-dashboard` sudah menutup halaman ini.
 */
const item = findNavItem('subscriptions');

export const metadata: Metadata = {
  title: item?.title ?? 'Langganan global',
  description: item?.description,
  robots: { index: false, follow: false },
};

export default async function SubscriptionsPage() {
  const rows = await listSubscriptionInvoices();

  return <SubscriptionsClient rows={rows} />;
}
