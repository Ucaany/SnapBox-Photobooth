import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { MachineDetailView } from '@/components/owner-dashboard/machine-detail-view';
import {
  getOwnerMachine,
  listOwnerMachines,
  requireOwnerTenant,
} from '@/lib/owner-dashboard/machine-server';

export const metadata: Metadata = { title: 'Detail mesin' };

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ boothId: string }>;
}) {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  const { boothId } = await params;
  const [machine, outletData] = await Promise.all([
    getOwnerMachine(auth.tenantId, boothId),
    listOwnerMachines(auth.tenantId),
  ]);
  if (!machine) notFound();
  return (
    <MachineDetailView machine={machine} outlets={outletData.outlets} tenantId={auth.tenantId} />
  );
}
