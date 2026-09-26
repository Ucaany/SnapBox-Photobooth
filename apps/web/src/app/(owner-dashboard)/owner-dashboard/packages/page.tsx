import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PackagesView } from '@/components/owner-dashboard/packages-view';
import { listOwnerPackages } from '@/lib/owner-dashboard/package-server';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';

export const metadata: Metadata = { title: 'Paket' };

export default async function PackagesPage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  return <PackagesView data={await listOwnerPackages(auth.tenantId)} />;
}
