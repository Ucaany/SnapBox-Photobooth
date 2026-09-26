import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OwnerNotificationsView } from '@/components/owner-dashboard/notifications-view';
import { listOwnerNotifications } from '@/lib/owner-dashboard/notifications-server';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Notifikasi', robots: { index: false, follow: false } };

export default async function OwnerNotificationsPage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  return (
    <OwnerNotificationsView
      items={await listOwnerNotifications(auth.tenantId, auth.session.userId)}
    />
  );
}
