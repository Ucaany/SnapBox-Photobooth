import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findNavItem } from '@/components/ceo-dashboard/content';
import { BroadcastView } from '@/components/ceo-dashboard/views/broadcast-view';
import { listBroadcastHistory, listBroadcastTenants } from '@/lib/ceo-dashboard/broadcast-server';
import { requireCeo } from '@/lib/ceo-dashboard/tenant-server';

/**
 * `/ceo-dashboard/broadcast` (PRD Task 1.9).
 *
 * Server component memuat tenant target dan riwayat broadcast NYATA dari DB,
 * lalu mengoper barisnya ke view klien. Route eksplisit ini menang atas
 * catch-all `[...segments]`, sehingga skeleton lama tidak pernah dirender.
 *
 * Otorisasi diulang ke DB (`requireCeo`) sebelum query karena middleware hanya
 * memverifikasi snapshot cookie (ADR-004). Loader juga memanggil `requireCeo`
 * sendiri; pemeriksaan ganda disengaja dan murah.
 */
const item = findNavItem('broadcast');

export const metadata: Metadata = {
  title: item?.title ?? 'Broadcast',
  description: item?.description,
  robots: { index: false, follow: false },
};

export default async function BroadcastPage() {
  if (!item) notFound();

  await requireCeo();

  const [tenants, history] = await Promise.all([listBroadcastTenants(), listBroadcastHistory()]);

  return <BroadcastView tenants={tenants} history={history} />;
}
