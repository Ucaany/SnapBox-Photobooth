import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OwnerSupportView } from '@/components/owner-dashboard/support-view';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Dukungan', robots: { index: false, follow: false } };

export default async function OwnerSupportPage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  return <OwnerSupportView />;
}
