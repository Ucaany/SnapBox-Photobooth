import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findNavItem } from '@/components/ceo-dashboard/content';
import { CeoView } from '@/components/ceo-dashboard/view-switch';

/**
 * Rute `[...segments]` di bawah `/ceo-dashboard` (PRD Task 1.3).
 *
 * Satu file menangani seluruh 11 subroute lewat registry, sehingga tidak ada
 * 10 salinan boilerplate yang bisa drift. Slug yang tidak ada di registry
 * memanggil `notFound()` sehingga menghasilkan 404, BUKAN halaman kosong.
 *
 * Batas dengan Task 1.4/1.5/1.6: rute multi-segmen milik halaman nyata
 * (`tenants/new`, `tenants/[id]`, `plans`, `subscriptions`) TIDAK boleh
 * dirender skeleton di sini. Next memilih rute paling spesifik lebih dulu;
 * penjaga di bawah memastikan catch-all tidak diam-diam menampilkan daftar
 * dummy bila pola itu berubah.
 *
 * Halaman tetap server component (metadata + `notFound()`); hanya view-nya yang
 * klien, karena setiap view memegang state filter/form.
 */
interface PageProps {
  params: Promise<{ segments?: string[] }>;
}

/** Prefix yang punya halaman nyata sendiri (Task 1.4 tenant, Task 1.5 plan, Task 1.6 invoice). */
const REAL_SUBROUTE_PREFIXES = ['tenants', 'plans', 'subscriptions'] as const;

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
