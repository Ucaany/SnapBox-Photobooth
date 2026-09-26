import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { StaffView } from '@/components/owner-dashboard/staff-view';
import {
  listOwnerStaff,
  ownerCompanyName,
  requireOwnerTenant,
  staffQuota,
} from '@/lib/owner-dashboard/staff-server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Staff' };

export default async function StaffPage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  const [staff, quota, companyName] = await Promise.all([
    listOwnerStaff(auth.tenantId),
    staffQuota(auth.tenantId),
    ownerCompanyName(auth.tenantId),
  ]);
  return <StaffView initialStaff={staff} initialQuota={quota} companyName={companyName} />;
}
