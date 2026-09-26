import type { Metadata } from 'next';

import { OwnerDashboardClientShell } from '@/components/owner-dashboard/owner-dashboard-client-shell';
import { getOwnerLayoutData } from '@/lib/owner-dashboard/owner-layout-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Owner Dashboard', template: '%s | SnapBox' },
  robots: { index: false, follow: false },
};

export default async function OwnerDashboardLayout({ children }: { children: React.ReactNode }) {
  const data = await getOwnerLayoutData();
  return <OwnerDashboardClientShell data={data}>{children}</OwnerDashboardClientShell>;
}
