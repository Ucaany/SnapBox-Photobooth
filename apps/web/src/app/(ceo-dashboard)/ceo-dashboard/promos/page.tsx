import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findNavItem } from '@/components/ceo-dashboard/content';
import { listGlobalPromos } from '@/lib/ceo-dashboard/promo-server';
import { requireCeo } from '@/lib/ceo-dashboard/tenant-server';

import { PromosEditor } from './promos-editor';

/**
 * `/ceo-dashboard/promos` (PRD Task 1.10).
 *
 * Server component memuat promo GLOBAL NYATA dari tabel `promos` supaya editor
 * tidak pernah menampilkan data contoh. Route eksplisit ini menang atas
 * catch-all `[...segments]`, sama seperti route Task 1.4/1.5/1.6.
 *
 * Otorisasi diulang ke DB (`requireCeo`) sebelum query karena middleware hanya
 * memverifikasi snapshot cookie (ADR-004).
 */
const item = findNavItem('promos');

export const metadata: Metadata = {
  title: item?.title ?? 'Promo global',
  description: item?.description,
  robots: { index: false, follow: false },
};

export default async function PromosPage() {
  if (!item) notFound();

  await requireCeo();

  const promos = await listGlobalPromos();

  return <PromosEditor promos={promos} />;
}
