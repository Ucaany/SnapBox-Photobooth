import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { OutletDetailView } from '@/components/owner-dashboard/outlet-detail-view';
import { getOwnerOutlet, requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';
export const metadata: Metadata = { title: 'Detail outlet' };
export default async function OutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  const outlet = await getOwnerOutlet(auth.tenantId, (await params).id);
  if (!outlet) notFound();
  return <OutletDetailView outlet={outlet} />;
}
