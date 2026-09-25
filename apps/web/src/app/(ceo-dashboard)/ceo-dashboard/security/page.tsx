import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findNavItem } from '@/components/ceo-dashboard/content';
import { getSecuritySnapshot } from '@/lib/ceo-dashboard/health-security-server';

import { SecurityClient } from './security-client';

/**
 * `/ceo-dashboard/security` (PRD Task 1.11).
 *
 * Server component memuat sinyal NYATA dari `security_events` dan `auth_sessions`
 * pada jendela 24 jam terakhir. Tidak ada data contoh; subjek dibatasi ke
 * fingerprint dan IP mentah tidak pernah dibaca.
 *
 * `getSecuritySnapshot` memanggil `requireCeo()` sebelum query (ADR-004).
 */
const item = findNavItem('security');

export const metadata: Metadata = {
  title: item?.title ?? 'Keamanan',
  description: item?.description,
  robots: { index: false, follow: false },
};

export default async function SecurityPage() {
  if (!item) notFound();

  const snapshot = await getSecuritySnapshot();

  return <SecurityClient snapshot={snapshot} />;
}
