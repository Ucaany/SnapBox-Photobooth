import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { DevicesView } from '@/components/owner-dashboard/devices-view';
import { listOwnerDevices, requireOwnerTenant } from '@/lib/owner-dashboard/device-server';

export const metadata: Metadata = { title: 'Perangkat' };

export default async function DevicesPage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  return <DevicesView data={await listOwnerDevices(auth.tenantId)} />;
}
