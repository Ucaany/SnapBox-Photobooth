import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findNavItem } from '@/components/ceo-dashboard/content';
import { SettingsView } from '@/components/ceo-dashboard/views/settings-view';
import { readSettingsSnapshot } from '@/lib/ceo-dashboard/settings-server';
import { requireCeo } from '@/lib/ceo-dashboard/tenant-server';

/**
 * `/ceo-dashboard/settings` (PRD Task 1.9).
 *
 * Server component memuat snapshot pengaturan global NYATA dari
 * `platform_settings` dan mengoper nilainya ke view klien. Route eksplisit ini
 * menang atas catch-all `[...segments]`.
 *
 * Snapshot TIDAK pernah memuat SMTP, API key, service-role, atau secret lain:
 * nilai itu tetap di env/secret manager (PRD Bab 8.2).
 */
const item = findNavItem('settings');

export const metadata: Metadata = {
  title: item?.title ?? 'Pengaturan global',
  description: item?.description,
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  if (!item) notFound();

  await requireCeo();

  const settings = await readSettingsSnapshot();

  return <SettingsView settings={settings} />;
}
