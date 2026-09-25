import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findNavItem } from '@/components/ceo-dashboard/content';
import { listPlansForEditor } from '@/lib/ceo-dashboard/plan-server';
import { requireCeo } from '@/lib/ceo-dashboard/tenant-server';

import { PlansEditor } from './plans-editor';

/**
 * `/ceo-dashboard/plans` (PRD Task 1.5).
 *
 * Server component memuat plan NYATA dari tabel `plans` supaya editor tidak
 * pernah menampilkan angka contoh. Route eksplisit ini menang atas catch-all
 * `[...segments]`, sama seperti route Task 1.4.
 *
 * Otorisasi diulang ke DB (`requireCeo`) sebelum query karena middleware hanya
 * memverifikasi snapshot cookie (ADR-004).
 *
 * `force-dynamic` di layout `/ceo-dashboard` sudah menutup halaman ini; build
 * tidak punya sesi/kredensial DB sehingga tidak boleh ada prerender.
 */
const item = findNavItem('plans');

export const metadata: Metadata = {
  title: item?.title ?? 'Paket dan harga',
  description: item?.description,
  robots: { index: false, follow: false },
};

export default async function PlansPage() {
  if (!item) notFound();

  await requireCeo();

  const plans = await listPlansForEditor();

  return <PlansEditor plans={plans} />;
}
