import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OwnerSettingsView } from '@/components/owner-dashboard/settings-view';
import { getOwnerSettings } from './actions';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pengaturan', robots: { index: false, follow: false } };

export default async function OwnerSettingsPage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  const profile = await getOwnerSettings(auth.session.userId);
  if (!profile) redirect('/unauthorized');
  return <OwnerSettingsView profile={profile} />;
}
