import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findOwnerNavItem } from '@/components/owner-dashboard/content';
import { getOwnerLayoutData } from '@/lib/owner-dashboard/owner-layout-data';

interface PageProps {
  params: Promise<{ segments?: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { segments } = await params;
  const item = findOwnerNavItem(segments?.[0] ?? '');
  if (!item) return { title: 'Halaman tidak ditemukan', robots: { index: false, follow: false } };
  return { title: item.title, description: item.description };
}

export default async function OwnerDashboardSectionPage({ params }: PageProps) {
  const { segments } = await params;
  if ((segments?.length ?? 0) !== 1) notFound();
  if (['outlets', 'machines', 'devices', 'frame-studio'].includes(segments?.[0] ?? '')) notFound();
  const item = findOwnerNavItem(segments?.[0] ?? '');
  if (!item || item.slug === '') notFound();
  await getOwnerLayoutData({ allowInactiveSubscription: item.slug === 'subscription' });

  return (
    <section className="owner-intro">
      <div>
        <p>{item.group}</p>
        <h1>{item.title}</h1>
        <span>{item.description}</span>
      </div>
      <aside>Segera hadir</aside>
    </section>
  );
}
