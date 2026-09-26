import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { MachinesView } from '@/components/owner-dashboard/machines-view';
import { listOwnerMachines, requireOwnerTenant } from '@/lib/owner-dashboard/machine-server';

export const metadata: Metadata = { title: 'Mesin' };

export default async function MachinesPage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  const data = await listOwnerMachines(auth.tenantId);
  return <MachinesView data={data} tenantId={auth.tenantId} />;
}
