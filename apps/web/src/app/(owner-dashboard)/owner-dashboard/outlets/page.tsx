import type { Metadata } from 'next';
import { OutletsView } from '@/components/owner-dashboard/outlets-view';
import {
  listOwnerOutlets,
  outletQuota,
  requireOwnerTenant,
} from '@/lib/owner-dashboard/outlet-server';
import { redirect } from 'next/navigation';
export const metadata: Metadata = { title: 'Outlet' };
export default async function OutletsPage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  const [rows, quota] = await Promise.all([
    listOwnerOutlets(auth.tenantId),
    outletQuota(auth.tenantId),
  ]);
  return <OutletsView outlets={rows} quota={quota} />;
}
