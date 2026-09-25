import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findNavItem } from '@/components/ceo-dashboard/content';
import { CeoView } from '@/components/ceo-dashboard/view-switch';

/**
 * Rute `[...segments]` di bawah `/ceo-dashboard` (PRD Task 1.3).
 *
 * Satu file menangani subroute registry, sehingga tidak ada salinan boilerplate
 * yang bisa drift. Slug yang tidak ada di registry memanggil `notFound()`
 * sehingga menghasilkan 404, BUKAN halaman kosong.
 *
 * Batas dengan rute nyata (Task 1.4 tenant, 1.5 plan, 1.6 invoice, 1.10 promo):
 * rute multi-segmen milik halaman nyata TIDAK boleh dirender skeleton di sini.
 * Next memilih rute paling spesifik lebih dulu; penjaga di bawah memastikan
 * catch-all tidak diam-diam menampilkan daftar dummy bila pola itu berubah.
 *
 * Halaman tetap server component (metadata + `notFound()`); hanya view-nya yang
 * klien, karena setiap view memegang state filter/form.
 */
interface PageProps {
  params: Promise<{ segments?: string[] }>;
}

/**
 * Prefix yang punya halaman nyata sendiri: Task 1.4 tenant, Task 1.5 plan,
 * Task 1.6 invoice, Task 1.10 promo, Task 1.11 system-health + security. Next
 * memilih rute paling spesifik lebih dulu, jadi cabang ini hanya jaring pengaman
 * bila pola rute berubah.
 */
const REAL_SUBROUTE_PREFIXES = [
  'tenants',
  'plans',
  'subscriptions',
  'promos',
  'system-health',
  'security',
] as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { segments } = await params;
  const slug = segments?.[0] ?? '';
  const item = findNavItem(slug);

  if (!item) {
    return { title: 'Halaman tidak ditemukan', robots: { index: false, follow: false } };
  }

  return {
    title: item.title,
    description: item.description,
  };
}

export default async function CeoDashboardSectionPage({ params }: PageProps) {
  const { segments } = await params;
  const slug = segments?.[0] ?? '';
  const isMultiSegment = (segments?.length ?? 0) > 1;

  if (isMultiSegment && (REAL_SUBROUTE_PREFIXES as readonly string[]).includes(slug)) {
    notFound();
  }

  if (!findNavItem(slug)) {
    notFound();
  }

  return <CeoView slug={slug} />;
}
